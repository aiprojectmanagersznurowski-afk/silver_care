import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

/**
 * @REQ: SEC-NO-PII-LOGS
 */
export class ApiError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST') {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
  }
}

/**
 * Standaryzowana, bezpieczna obsługa błędów w trasach API.
 * Zapobiega wyciekowi szczegółów bazy danych, zapytań SQL i danych PII do klienta.
 * 
 * @REQ: SEC-NO-PII-LOGS
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  const errorId = crypto.randomUUID()

  if (error instanceof ApiError) {
    console.warn(`[API_WARN] [${errorId}] ${context ? `[${context}] ` : ''}${error.code}: ${error.message}`)
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        error_id: errorId,
      },
      { status: error.statusCode }
    )
  }

  // Obsługa błędów PostgREST / Supabase
  const pgError = error as { code?: string; message?: string; hint?: string }
  if (pgError && typeof pgError.code === 'string') {
    console.error(`[DB_ERROR] [${errorId}] ${context ? `[${context}] ` : ''}pg_code=${pgError.code}`)

    // 23505 - Unique constraint violation
    if (pgError.code === '23505') {
      return NextResponse.json(
        {
          error: 'Rekord o podanych parametrach unikalnych już istnieje.',
          code: 'RESOURCE_CONFLICT',
          error_id: errorId,
        },
        { status: 409 }
      )
    }

    // 23503 - Foreign key violation
    if (pgError.code === '23503') {
      return NextResponse.json(
        {
          error: 'Odwołanie do nieistniejącego zasobu powiązanego.',
          code: 'FOREIGN_KEY_VIOLATION',
          error_id: errorId,
        },
        { status: 400 }
      )
    }

    // 42501 - RLS policy violation / permission denied
    if (pgError.code === '42501') {
      return NextResponse.json(
        {
          error: 'Brak uprawnień do wykonania tej operacji na zasobie.',
          code: 'PERMISSION_DENIED',
          error_id: errorId,
        },
        { status: 403 }
      )
    }
  }

  // Ogólny błąd nieoczekiwany - maskujemy szczegóły
  console.error(`[SERVER_ERROR] [${errorId}] ${context ? `[${context}] ` : ''}error=An unexpected internal error occurred`)
  return NextResponse.json(
    {
      error: 'Wystąpił nieoczekiwany błąd serwera.',
      code: 'INTERNAL_SERVER_ERROR',
      error_id: errorId,
    },
    { status: 500 }
  )
}
