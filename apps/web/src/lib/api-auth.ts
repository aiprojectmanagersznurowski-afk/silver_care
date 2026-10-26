import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/api-errors'
import { isImpersonationSessionActive, safeGetCookieStore } from '@/lib/impersonation-guards'
import { getAppRole, getAppOrganizationId } from '@/lib/auth/app-role'

export interface AuthenticatedUser {
  id: string
  email?: string
  role: string
  organizationId?: string
  isImpersonated?: boolean
  impersonatorId?: string
  rawUser: unknown
}

export interface ApiAuthContext {
  user: AuthenticatedUser
  supabase: ReturnType<typeof createClient> extends Promise<infer R> ? R : ReturnType<typeof createClient>
  params?: Record<string, string | string[]>
}

export interface WithAuthOptions {
  roles?: string[]
  requireOrganization?: boolean
  blockImpersonation?: boolean
}

type ApiRouteHandler = (
  request: NextRequest,
  context: ApiAuthContext
) => Promise<NextResponse> | NextResponse

/**
 * Centralny wrapper autoryzacyjny dla tras API.
 * Weryfikuje sesję użytkownika, token Bearer, role (RBAC) oraz przynależność organizacyjną.
 *
 * @REQ: SEC-SESSION
 * @REQ: SEC-403-LOGGING
 * @REQ: ORG-ISOLATION
 */
export function withAuth(handler: ApiRouteHandler, options: WithAuthOptions = {}) {
  return async function (
    request: NextRequest,
    routeProps: { params: Promise<Record<string, string | string[]>> }
  ): Promise<NextResponse> {
    try {
      // 1. Sprawdź ewentualny nagłówek Bearer
      const authHeader = request.headers.get('authorization')
      let bearerToken: string | undefined
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        bearerToken = authHeader.substring(7).trim()
      }

      const supabase = await createClient(bearerToken)
      const {
        data: { user: rawUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !rawUser) {
        return NextResponse.json(
          {
            error: 'Wymagane uwierzytelnienie do tego zasobu.',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        )
      }

      // Rola i placówka wyłącznie z app_metadata (user_metadata użytkownik edytuje sam)
      const role = getAppRole(rawUser) ?? 'authenticated'

      const organizationId = getAppOrganizationId(rawUser) ?? undefined

      const impersonatorId =
        (rawUser.app_metadata?.impersonator_id as string) || undefined

      const user: AuthenticatedUser = {
        id: rawUser.id,
        email: rawUser.email,
        role,
        organizationId,
        isImpersonated: Boolean(impersonatorId),
        impersonatorId,
        rawUser,
      }

      // 2. Weryfikacja ról (RBAC)
      if (options.roles && options.roles.length > 0) {
        const hasRole = options.roles.includes(role)
        if (!hasRole) {
          // Log odmowy dostępu bez danych PII (@REQ: SEC-403-LOGGING)
          console.warn(
            `[ACCESS_DENIED_403] user_id=${user.id} role=${role} required_roles=${options.roles.join(',')} path=${request.nextUrl.pathname}`
          )

          return NextResponse.json(
            {
              error: 'Brak wystarczających uprawnień do wykonania tej operacji.',
              code: 'FORBIDDEN',
            },
            { status: 403 }
          )
        }
      }

      // 3. Weryfikacja wymogu organizacji
      if (options.requireOrganization && !organizationId && role !== 'super_admin') {
        return NextResponse.json(
          {
            error: 'Brak przypisania do aktywnej organizacji.',
            code: 'NO_ORGANIZATION_ASSIGNED',
          },
          { status: 403 }
        )
      }

      // 4. Blokada mutacji w trybie impersonacji (@REQ: SUP-IMPERSONATION)
      if (options.blockImpersonation) {
        const cookieStore = await safeGetCookieStore()
        if (isImpersonationSessionActive(cookieStore, rawUser as { id: string; app_metadata?: Record<string, unknown> })) {
          return NextResponse.json(
            {
              error: 'Operacja niedozwolona w trybie podglądu (impersonacji). Tryb jest ściśle Read-Only.',
              code: 'IMPERSONATION_READ_ONLY',
            },
            { status: 403 }
          )
        }
      }

      // Rozwiń params jeśli są promisem (Next.js 15+)
      const resolvedParams = routeProps?.params
        ? await Promise.resolve(routeProps.params)
        : undefined

      const authContext: ApiAuthContext = {
        user,
        supabase,
        params: resolvedParams,
      }

      return await handler(request, authContext)
    } catch (error) {
      return handleApiError(error, request.nextUrl.pathname)
    }
  }
}
