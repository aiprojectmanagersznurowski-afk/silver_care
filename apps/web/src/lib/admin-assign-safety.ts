/**
 * @REQ: ORG-PROVISION
 * @REQ: SUP-IAM-PANEL
 * @REQ: ORG-ISOLATION
 *
 * Bezpieczne przypisanie administratora placówki:
 * 1. Paginowane wyszukiwanie użytkownika w Supabase Auth po adresie e-mail.
 * 2. Walidacja roli — ochrona przed degradacją super_admin oraz zachowanie izolacji placówek.
 */

export interface ExistingUserInfo {
  id: string;
  email?: string | null;
  app_metadata?: {
    role?: string;
    organization_id?: string;
    [key: string]: any;
  };
  user_metadata?: {
    [key: string]: any;
  };
}

export interface AdminAssignmentInput {
  existingUser: ExistingUserInfo | null | undefined;
  targetOrgId: string;
}

export type AdminAssignmentDecision =
  | {
      allowed: true;
      isExistingUser: boolean;
      alreadyAdmin?: boolean;
    }
  | {
      allowed: false;
      errorCode: 'SUPER_ADMIN_CONFLICT' | 'ORGANIZATION_MISMATCH';
      error: string;
    };

/**
 * Paginowane wyszukiwanie użytkownika po e-mailu.
 * Przeszukuje kolejne strony Auth API do momentu znalezienia lub wyczerpania listy.
 */
export async function findUserByEmail(
  adminClient: { auth: { admin: { listUsers: (params: { page: number; perPage: number }) => Promise<any> } } },
  email: string
): Promise<ExistingUserInfo | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 50;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users || data.users.length === 0) {
      break;
    }

    const match = data.users.find(
      (u: ExistingUserInfo) => u.email?.trim().toLowerCase() === normalizedEmail
    );
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      break;
    }

    page++;
  }

  return null;
}

/**
 * Ocena dopuszczalności przypisania roli org_admin do wskazanego konta.
 */
export function evaluateAdminAssignment(input: AdminAssignmentInput): AdminAssignmentDecision {
  const { existingUser, targetOrgId } = input;

  // Nowe konto
  if (!existingUser) {
    return {
      allowed: true,
      isExistingUser: false,
      alreadyAdmin: false,
    };
  }

  const currentRole = existingUser.app_metadata?.role;
  const currentOrgId = existingUser.app_metadata?.organization_id;

  // 1. Ochrona operatora platformy — zakaz degradacji super_admin
  if (currentRole === 'super_admin') {
    return {
      allowed: false,
      errorCode: 'SUPER_ADMIN_CONFLICT',
      error: 'Nie można przypisać roli administratora placówki do konta operatora platformy (super_admin).',
    };
  }

  // 2. Ochrona izolacji najemców — zakaz przenoszenia administratora innej placówki
  if (currentOrgId && currentOrgId !== targetOrgId) {
    return {
      allowed: false,
      errorCode: 'ORGANIZATION_MISMATCH',
      error: 'Użytkownik jest już powiązany z innej placówki. Aby zmienić przypisanie, zmodyfikuj rolę w panelu IAM.',
    };
  }

  // 3. Użytkownik jest już org_admin w tej samej placówce
  if (currentOrgId === targetOrgId && currentRole === 'org_admin') {
    return {
      allowed: true,
      isExistingUser: true,
      alreadyAdmin: true,
    };
  }

  // 4. Dozwolone przypisanie (konto bez ról lub bez placówki)
  return {
    allowed: true,
    isExistingUser: true,
    alreadyAdmin: false,
  };
}
