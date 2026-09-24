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

function mapPgTypeToTs(udtName, dataType) {
  switch (dataType) {
    case 'boolean':
      return 'boolean'
    case 'integer':
    case 'smallint':
    case 'bigint':
    case 'numeric':
    case 'double precision':
    case 'real':
      return 'number'
    case 'text':
    case 'character varying':
    case 'character':
    case 'uuid':
    case 'date':
    case 'timestamp with time zone':
    case 'timestamp without time zone':
    case 'time with time zone':
    case 'time without time zone':
      return 'string'
    case 'json':
    case 'jsonb':
      return 'Json'
    case 'ARRAY':
      return 'unknown[]'
    default:
      if (udtName === 'uuid' || udtName === 'text' || udtName === 'varchar') return 'string'
      if (udtName === 'bool') return 'boolean'
      if (udtName === 'int4' || udtName === 'int8' || udtName === 'int2' || udtName === 'numeric') return 'number'
      if (udtName === 'json' || udtName === 'jsonb') return 'Json'
      return 'unknown'
  }
}

async function run() {
  console.log('Pobieranie definicji tabel i kolumn ze schematu public...')

  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `

  const columns = await sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `

  const tableCols = new Map()
  for (const col of columns) {
    if (!tableCols.has(col.table_name)) {
      tableCols.set(col.table_name, [])
    }
    tableCols.get(col.table_name).push(col)
  }

  let code = `// ==============================================================================\n`
  code += `// Automatycznie wygenerowane typy bazy danych Silver Care (PostgreSQL/Supabase)\n`
  code += `// Wygenerowano: ${new Date().toISOString()}\n`
  code += `// ==============================================================================\n\n`
  code += `export type Json =\n`
  code += `  | string\n`
  code += `  | number\n`
  code += `  | boolean\n`
  code += `  | null\n`
  code += `  | { [key: string]: Json | undefined }\n`
  code += `  | Json[]\n\n`
  code += `export interface Database {\n`
  code += `  public: {\n`
  code += `    Tables: {\n`

  for (const t of tables) {
    const tName = t.table_name
    const cols = tableCols.get(tName) || []

    code += `      ${tName}: {\n`

    // Row type
    code += `        Row: {\n`
    for (const c of cols) {
      const tsType = mapPgTypeToTs(c.udt_name, c.data_type)
      const nullable = c.is_nullable === 'YES' ? ' | null' : ''
      code += `          ${c.column_name}: ${tsType}${nullable}\n`
    }
    code += `        }\n`

    // Insert type
    code += `        Insert: {\n`
    for (const c of cols) {
      const tsType = mapPgTypeToTs(c.udt_name, c.data_type)
      const optional = c.column_default !== null || c.is_nullable === 'YES' ? '?' : ''
      const nullable = c.is_nullable === 'YES' ? ' | null' : ''
      code += `          ${c.column_name}${optional}: ${tsType}${nullable}\n`
    }
    code += `        }\n`

    // Update type
    code += `        Update: {\n`
    for (const c of cols) {
      const tsType = mapPgTypeToTs(c.udt_name, c.data_type)
      const nullable = c.is_nullable === 'YES' ? ' | null' : ''
      code += `          ${c.column_name}?: ${tsType}${nullable}\n`
    }
    code += `        }\n`
    code += `        Relationships: []\n`
    code += `      }\n`
  }

  code += `    }\n`
  code += `    Views: {\n`
  code += `      [_ in string]: {\n`
  code += `        Row: Record<string, unknown>\n`
  code += `      }\n`
  code += `    }\n`
  code += `    Functions: {\n`
  code += `      [_ in string]: {\n`
  code += `        Args: Record<string, unknown>\n`
  code += `        Returns: unknown\n`
  code += `      }\n`
  code += `    }\n`
  code += `    Enums: {\n`
  code += `      [_ in string]: string\n`
  code += `    }\n`
  code += `  }\n`
  code += `}\n`

  const targetDir = path.resolve('apps/web/src/types')
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

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
