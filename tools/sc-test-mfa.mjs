#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

function run(file, args, input) {
  return execFileSync(file, args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function testContainer(workdir) {
  const config = readFileSync(join(workdir, 'supabase', 'config.toml'), 'utf8');
  const project = config.match(/^project_id\s*=\s*"(silvercare-test-[a-z0-9-]+)"\s*$/m)?.[1];
  if (!project) throw new Error('Wymagany jest odizolowany projekt Supabase o nazwie silvercare-test-*.');

  const endpoint = process.env.DOCKER_HOST ||
    run('docker', ['context', 'inspect', '--format', '{{(index .Endpoints "docker").Host}}']);
  if (!endpoint.startsWith('unix://')) throw new Error('Wymagany jest lokalny Docker.');

  const status = JSON.parse(run('supabase', ['--workdir', workdir, 'status', '-o', 'json']));
  const api = new URL(status.API_URL);
  const db = new URL(status.DB_URL);
  if (!localHosts.has(api.hostname) || !localHosts.has(db.hostname)
    || db.username !== 'postgres' || db.pathname !== '/postgres') {
    throw new Error('Wymagane są lokalne adresy API i testowej bazy.');
  }

  const container = 'supabase_db_' + project;
  const label = run('docker', ['inspect', '--type', 'container', '--format',
    '{{index .Config.Labels "com.supabase.cli.project"}}', container]);
  const publishedPorts = run('docker', ['port', container, '5432/tcp']).split('\n');
  if (label !== project || !db.port || !publishedPorts.some((port) => port.endsWith(':' + db.port))) {
    throw new Error('Kontener nie odpowiada lokalnej konfiguracji Supabase.');
  }
  return container;
}

function main() {
  const [mode, path, ...other] = process.argv.slice(2);
  if (!['disable', 'require', 'status'].includes(mode) || !path || other.length) {
    throw new Error('Użycie: node tools/sc-test-mfa.mjs disable|require|status <lokalny-workdir-supabase>');
  }
  const container = testContainer(resolve(path));
  const command = ['exec', '-i', container, 'psql', '-XqAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-1'];
  const read = 'SELECT private.staff_mfa_disabled_for_tests();\n';
  const current = run('docker', command, read);
  if (current !== 't' && current !== 'f') throw new Error('Baza nie zwróciła stanu polityki MFA.');

  const disabled = mode === 'status' ? current === 't' : mode === 'disable';
  if (mode !== 'status' && disabled !== (current === 't')) {
    run('docker', command,
      'CREATE OR REPLACE FUNCTION private.staff_mfa_disabled_for_tests() RETURNS boolean\n'
      + "LANGUAGE sql STABLE SET search_path = '' RETURN " + (disabled ? 'true' : 'false') + ';\n');
  }
  console.log(disabled ? 'MFA pomijane w lokalnych testach syntetycznych.' : 'MFA wymagane w lokalnym projekcie.');
}

try {
  main();
} catch (error) {
  console.error(error.status === undefined ? error.message : 'Polecenie lokalnego Supabase lub Dockera zakończyło się błędem.');
  process.exitCode = 1;
}
