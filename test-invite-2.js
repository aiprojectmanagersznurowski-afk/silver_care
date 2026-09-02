import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: 'apps/web/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const email = `test-invite-already-exists@example.com`
  console.log('1. Creating user:', email)
  
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { role: 'nurse', organization_id: 'test-org' }
  })
  
  if (createError && createError.code !== 'user_already_exists') {
    console.error('Create error', createError)
    return
  }
  
  console.log('User created or exists')
  
  console.log('2. Generating invite link...')
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email,
  })
  
  if (linkError) {
    console.error('Link error', linkError)
    return
  }
  
  const actionLink = linkData.properties.action_link
  console.log('Generated action link:', actionLink)
  
  // Try to use the link
  console.log('3. Fetching link to simulate click...')
  const res = await fetch(actionLink, { redirect: 'manual' })
  console.log('Status:', res.status)
  console.log('Location:', res.headers.get('location'))
}

run()
