const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const email = `test-invite-${Date.now()}@example.com`
  console.log('1. Creating user:', email)
  
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { role: 'nurse', organization_id: 'test-org' }
  })
  
  if (createError) {
    console.error('Create error', createError)
    return
  }
  
  console.log('User created:', newUser.user.id)
  
  console.log('2. Generating invite link 1...')
  const { data: linkData1, error: linkError1 } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email,
  })
  if (linkError1) return console.error('Link error 1', linkError1)
  console.log('Link 1:', linkData1.properties.action_link)
  
  console.log('3. Generating invite link 2...')
  const { data: linkData2, error: linkError2 } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: email,
  })
  if (linkError2) return console.error('Link error 2', linkError2)
  console.log('Link 2:', linkData2.properties.action_link)
  
  console.log('4. Testing Link 1...')
  const res1 = await fetch(linkData1.properties.action_link, { redirect: 'manual' })
  console.log('Link 1 Location:', res1.headers.get('location'))

  console.log('5. Testing Link 2...')
  const res2 = await fetch(linkData2.properties.action_link, { redirect: 'manual' })
  console.log('Link 2 Location:', res2.headers.get('location'))
}

run()
