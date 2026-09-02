const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const email = `test-invite-already-exists-3@example.com`
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
  
  console.log('3. Fetching link to simulate click...')
  const res = await fetch(actionLink, { redirect: 'manual' })
  console.log('Status:', res.status)
  console.log('Location:', res.headers.get('location'))
}

run()
