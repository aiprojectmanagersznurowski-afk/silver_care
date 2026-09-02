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
  const email = `test-invite-${Date.now()}@example.com`
  console.log('Generating link for', email)
  
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
  
  console.log('Fetching link BEFORE update...')
  // Do not fetch it actually, otherwise it consumes it. We want to test if update invalidates it.
  
  // Now update the user
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(linkData.user.id, {
    app_metadata: { role: 'nurse', organization_id: 'test-org' }
  })
  
  if (updateError) {
    console.error('Update error', updateError)
    return
  }
  
  console.log('User updated successfully')
  
  // Try to use the link
  console.log('Fetching link AFTER update...')
  const res = await fetch(actionLink, { redirect: 'manual' })
  console.log('Status:', res.status)
  console.log('Location:', res.headers.get('location'))
}

run()
