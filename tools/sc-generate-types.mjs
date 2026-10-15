import postgres from 'postgres'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('Brak DATABASE_URL w .env.local')
  process.exit(1)
}

const sql = postgres(dbUrl, { prepare: false })

function mapPgTypeToTs(udtName, dataType, tableNames = []) {
  if (dataType === 'boolean' || udtName === 'bool') return 'boolean'
  if (['integer', 'smallint', 'bigint', 'numeric', 'double precision', 'real', 'int2', 'int4', 'int8'].includes(dataType) ||
      ['int2', 'int4', 'int8', 'numeric'].includes(udtName)) return 'number'
  if (['text', 'character varying', 'character', 'uuid', 'date', 'timestamp with time zone', 'timestamp without time zone', 'time with time zone', 'time without time zone', 'varchar'].includes(dataType) ||
      ['uuid', 'text', 'varchar'].includes(udtName)) return 'string'
  if (['json', 'jsonb'].includes(dataType) || ['json', 'jsonb'].includes(udtName)) return 'Json'
  if (dataType === 'ARRAY') return 'unknown[]'
  if (tableNames.includes(udtName)) return `Database["public"]["Tables"]["${udtName}"]["Row"]`
  return 'unknown'
}

async function run() {
  console.log('Pobieranie definicji tabel, widoków, relacji i funkcji ze schematu public...')

  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  const tableNames = tables.map(t => t.table_name)

  const columns = await sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`

  const tableCols = new Map()
  for (const c of columns) {
    if (!tableCols.has(c.table_name)) tableCols.set(c.table_name, [])
    tableCols.get(c.table_name).push(c)
  }

  const fks = await sql`
    SELECT tc.table_name, tc.constraint_name as foreign_key_name, kcu.column_name,
      ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name,
      EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc2
        JOIN information_schema.key_column_usage kcu2
          ON tc2.constraint_name = kcu2.constraint_name AND tc2.table_schema = kcu2.table_schema
        WHERE tc2.table_name = tc.table_name AND tc2.table_schema = 'public'
          AND tc2.constraint_type IN ('UNIQUE', 'PRIMARY KEY') AND kcu2.column_name = kcu.column_name
        GROUP BY tc2.constraint_name
        HAVING (SELECT COUNT(*) FROM information_schema.key_column_usage kcu3 
                WHERE kcu3.constraint_name = tc2.constraint_name AND kcu3.table_schema = 'public') = 1
      ) AS is_one_to_one
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, tc.constraint_name;`

  const tableFks = new Map()
  for (const fk of fks) {
    if (!tableFks.has(fk.table_name)) tableFks.set(fk.table_name, [])
    tableFks.get(fk.table_name).push(fk)
  }

  const views = await sql`SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name`
  const computedCols = await sql`
    SELECT r.routine_name, r.data_type, r.type_udt_name, p.udt_name AS table_name
    FROM information_schema.routines r
    JOIN information_schema.parameters p ON p.specific_name = r.specific_name
    WHERE r.routine_schema = 'public' AND p.parameter_mode = 'IN' AND p.ordinal_position = 1
      AND p.data_type = 'USER-DEFINED'
      AND (SELECT count(*) FROM information_schema.parameters p2 WHERE p2.specific_name = r.specific_name AND p2.parameter_mode = 'IN') = 1`

  const tableComputed = new Map()
  for (const cc of computedCols) {
    if (!tableComputed.has(cc.table_name)) tableComputed.set(cc.table_name, [])
    tableComputed.get(cc.table_name).push(cc)
  }

  const routines = await sql`
    SELECT r.routine_name, r.specific_name, r.data_type, r.type_udt_name, p.proretset
    FROM information_schema.routines r
    JOIN pg_proc p ON p.oid = substring(r.specific_name from '_([0-9]+)$')::oid
    WHERE r.routine_schema = 'public' AND r.data_type != 'trigger' ORDER BY r.routine_name`

  const params = await sql`
    SELECT specific_name, parameter_name, data_type, udt_name, parameter_mode, parameter_default
    FROM information_schema.parameters WHERE specific_schema = 'public' ORDER BY specific_name, ordinal_position`

  const paramsBySpec = new Map()
  for (const p of params) {
    if (!paramsBySpec.has(p.specific_name)) paramsBySpec.set(p.specific_name, [])
    paramsBySpec.get(p.specific_name).push(p)
  }

  let code = `// ==============================================================================\n` +
    `// Automatycznie wygenerowane typy bazy danych Silver Care (PostgreSQL/Supabase)\n` +
    `// Wygenerowano: ${new Date().toISOString()}\n` +
    `// ==============================================================================\n\n` +
    `export type Json =\n  | string\n  | number\n  | boolean\n  | null\n  | { [key: string]: Json | undefined }\n  | Json[]\n\n` +
    `export interface Database {\n  public: {\n    Tables: {\n`

  for (const t of tables) {
    const tName = t.table_name
    const cols = tableCols.get(tName) || []
    const rels = tableFks.get(tName) || []

    const computed = tableComputed.get(tName) || []
    code += `      ${tName}: {\n        Row: {\n`
    for (const c of cols) {
      const ts = mapPgTypeToTs(c.udt_name, c.data_type, tableNames)
      code += `          ${c.column_name}: ${ts}${c.is_nullable === 'YES' ? ' | null' : ''}\n`
    }
    for (const comp of computed) {
      const ts = mapPgTypeToTs(comp.type_udt_name, comp.data_type, tableNames)
      code += `          ${comp.routine_name}?: ${ts}\n`
    }
    code += `        }\n        Insert: {\n`
    for (const c of cols) {
      const ts = mapPgTypeToTs(c.udt_name, c.data_type, tableNames)
      const opt = c.column_default !== null || c.is_nullable === 'YES' ? '?' : ''
      code += `          ${c.column_name}${opt}: ${ts}${c.is_nullable === 'YES' ? ' | null' : ''}\n`
    }
    code += `        }\n        Update: {\n`
    for (const c of cols) {
      const ts = mapPgTypeToTs(c.udt_name, c.data_type, tableNames)
      code += `          ${c.column_name}?: ${ts}${c.is_nullable === 'YES' ? ' | null' : ''}\n`
    }
    code += `        }\n        Relationships: [\n`
    for (const rel of rels) {
      code += `          {\n            foreignKeyName: "${rel.foreign_key_name}"\n            columns: ["${rel.column_name}"]\n` +
        `            isOneToOne: ${rel.is_one_to_one ? 'true' : 'false'}\n            referencedRelation: "${rel.foreign_table_name}"\n` +
        `            referencedColumns: ["${rel.foreign_column_name}"]\n          },\n`
    }
    code += `        ]\n      }\n`
  }
  code += `    }\n    Views: {\n`
  for (const v of views) {
    const cols = tableCols.get(v.table_name) || []
    code += `      ${v.table_name}: {\n        Row: {\n`
    for (const c of cols) {
      code += `          ${c.column_name}: ${mapPgTypeToTs(c.udt_name, c.data_type, tableNames)} | null\n`
    }
    code += `        }\n        Relationships: []\n      }\n`
  }
  code += `    }\n    Functions: {\n`
  for (const r of routines) {
    const ps = paramsBySpec.get(r.specific_name) || []
    const inParams = ps.filter(p => p.parameter_mode === 'IN' || p.parameter_mode === 'INOUT')
    const outParams = ps.filter(p => p.parameter_mode === 'OUT' || p.parameter_mode === 'INOUT')

    code += `      ${r.routine_name}: {\n`
    if (inParams.length === 0) {
      code += `        Args: Record<PropertyKey, never>\n`
    } else {
      code += `        Args: {\n`
      for (const p of inParams) {
        const opt = p.parameter_default !== null ? '?' : ''
        const nullable = p.parameter_default !== null ? ' | null' : ''
        code += `          ${p.parameter_name}${opt}: ${mapPgTypeToTs(p.udt_name, p.data_type, tableNames)}${nullable}\n`
      }
      code += `        }\n`
    }

    if (r.proretset) {
      if (r.data_type === 'record' && outParams.length > 0) {
        code += `        Returns: {\n`
        for (const op of outParams) {
          code += `          ${op.parameter_name}: ${mapPgTypeToTs(op.udt_name, op.data_type, tableNames)}\n`
        }
        code += `        }[]\n`
      } else if (r.data_type === 'USER-DEFINED' && tableNames.includes(r.type_udt_name)) {
        code += `        Returns: Database["public"]["Tables"]["${r.type_udt_name}"]["Row"][]\n`
      } else {
        code += `        Returns: ${mapPgTypeToTs(r.type_udt_name, r.data_type, tableNames)}[]\n`
      }
    } else {
      if (r.data_type === 'void') {
        code += `        Returns: undefined\n`
      } else if (r.data_type === 'USER-DEFINED' && tableNames.includes(r.type_udt_name)) {
        code += `        Returns: Database["public"]["Tables"]["${r.type_udt_name}"]["Row"] | null\n`
      } else {
        code += `        Returns: ${mapPgTypeToTs(r.type_udt_name, r.data_type, tableNames)}\n`
      }
    }
    code += `      }\n`
  }
  code += `    }\n    Enums: {\n      [_ in string]: string\n    }\n  }\n}\n\n`

  code += `export type Tables<
  PublicTableNameOrOptions extends | keyof (Database["public"]["Tables"] & Database["public"]["Views"]) | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"]) : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] & Database["public"]["Views"])
  ? (Database["public"]["Tables"] & Database["public"]["Views"])[PublicTableNameOrOptions] extends { Row: infer R } ? R : never : never\n\n`

  code += `export type TablesInsert<
  PublicTableNameOrOptions extends | keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"] : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends { Insert: infer I } ? I : never : never\n\n`

  code += `export type TablesUpdate<
  PublicTableNameOrOptions extends | keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"] : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends { Update: infer U } ? U : never : never\n\n`

  code += `export type Enums<
  PublicEnumNameOrOptions extends | keyof Database["public"]["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"] : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions] : never\n`

  const targetDir = path.resolve('apps/web/src/types')
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
  const targetFile = path.join(targetDir, 'database.types.ts')
  fs.writeFileSync(targetFile, code, 'utf8')
  console.log(`✅ Pomyślnie wygenerowano typy w: ${targetFile}`)
  await sql.end()
}

run().catch(async (e) => {
  console.error('Błąd generowania typów:', e)
  await sql.end()
  process.exit(1)
})
