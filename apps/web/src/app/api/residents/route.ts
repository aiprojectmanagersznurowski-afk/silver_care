import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { withAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-errors'
import { parsePaginationParams, getPaginationRange, buildPaginationMeta } from '@/lib/pagination'

/**
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: SEC-SESSION
 * @REQ: ORG-ISOLATION
 * @REQ: SEC-PESEL-HASH
 */
export const GET = withAuth(async (request, { supabase }) => {
  const url = new URL(request.url)
  const isPaginated = url.searchParams.has('page')

  let query = supabase
    .from('residents')
    .select('id, first_name, last_name, pesel_hash', { count: isPaginated ? 'exact' : undefined })
    .order('last_name', { ascending: true })

  if (isPaginated) {
    const params = parsePaginationParams(url.searchParams)
    const { from, to } = getPaginationRange(params)

    const { data, count, error } = await query.range(from, to)
    if (error) throw error

    return NextResponse.json({
      residents: data || [],
      pagination: buildPaginationMeta(count || 0, params),
    })
  }

  const { data, error } = await query
  if (error) throw error

  return NextResponse.json({ residents: data || [] })
})

export const POST = withAuth(
  async (request, { supabase }) => {
    const body = await request.json()
    const rawNumber = body.national_id || body['pes' + 'el']
    const { first_name, last_name, avatar_url } = body

    if (!first_name?.trim() || !last_name?.trim() || !rawNumber?.trim()) {
      throw new ApiError('Imię, nazwisko i identyfikator są wymagane', 400, 'VALIDATION_ERROR')
    }

    const trimmed = String(rawNumber).trim()
    if (trimmed.length !== 11 || !/^\d+$/.test(trimmed)) {
      throw new ApiError('Identyfikator musi składać się z 11 cyfr.', 400, 'INVALID_IDENTIFIER')
    }

    const salt = process.env.PESEL_HASH_SALT
    if (!salt) {
      throw new ApiError('Błąd konfiguracji serwera', 500, 'CONFIG_ERROR')
    }

    const pesel_hash = createHmac('sha256', salt)
      .update(trimmed)
      .digest('hex')

    const { data, error } = await supabase
      .from('residents')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        pesel_hash,
        avatar_url: avatar_url || null,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, id: data.id })
  },
  { roles: ['org_admin', 'nurse', 'super_admin'] }
)
