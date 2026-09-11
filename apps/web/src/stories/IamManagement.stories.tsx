import type { Meta, StoryObj } from '@storybook/react'
import { IamManagementClient } from '@/components/IamManagementClient'

const meta: Meta<typeof IamManagementClient> = {
  title: 'Admin/IAM/IamManagementClient',
  component: IamManagementClient,
  parameters: {
    layout: 'padded',
  },
}

export default meta
type Story = StoryObj<typeof IamManagementClient>

const mockUsers = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@placowka.pl',
    role: 'org_admin',
    organizationId: 'org-abc-123',
    lastSignInAt: '2026-09-10T10:30:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'pielegniarka@placowka.pl',
    role: 'nurse',
    organizationId: 'org-abc-123',
    lastSignInAt: '2026-09-11T07:15:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'opiekun.prawny@rodzina.pl',
    role: 'legal_guardian',
    organizationId: 'org-abc-123',
    lastSignInAt: '2026-09-08T14:20:00Z',
  }
]

const mockAuditLogs = [
  {
    id: 'log-1',
    action: 'role_change',
    performed_by: 'super-admin-root',
    payload: {
      target_user_id: '22222222-2222-2222-2222-222222222222',
      previous_role: 'family',
      new_role: 'nurse',
      changed_at: '2026-09-11T08:00:00Z'
    },
    created_at: '2026-09-11T08:00:00Z'
  }
]

// 1. Loading State
export const Loading: Story = {
  args: {
    initialUsers: [],
    initialAuditLogs: [],
    forcedState: 'loading',
  },
}

// 2. Empty State
export const Empty: Story = {
  args: {
    initialUsers: [],
    initialAuditLogs: [],
    forcedState: 'empty',
  },
}

// 3. Success State
export const Success: Story = {
  args: {
    initialUsers: mockUsers,
    initialAuditLogs: mockAuditLogs,
    forcedState: 'success',
  },
}

// 4. Error State
export const ErrorState: Story = {
  args: {
    initialUsers: [],
    initialAuditLogs: [],
    forcedState: 'error',
    errorMessage: 'Błąd połączenia z usługą Supabase Auth lub bazą danych.',
  },
}
