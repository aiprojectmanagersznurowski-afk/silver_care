import { describe, it, expect, vi } from 'vitest'
import { residentPhotoUrls, RESIDENT_PHOTO_BUCKET, RESIDENT_PHOTO_URL_TTL } from '../../apps/web/src/lib/resident-photo'

/**
 * @REQ: ADM-RESIDENT-PHOTO
 * @REQ: SEC-NO-PII-LOGS
 *
 * SC-ADM-25/AC3: zdjęcie pokazywane przez krótkotrwały podpisany link z prywatnego bucketu,
 * podpisywany klientem sesji (o dostępie decyduje RLS storage). Brak ścieżki = brak zdjęcia.
 */
function client(result: { data: { path: string; signedUrl: string; error: string | null }[] | null; error: { message: string } | null }) {
  const createSignedUrls = vi.fn(async () => result)
  const from = vi.fn(() => ({ createSignedUrls }))
  return { supabase: { storage: { from } } as never, from, createSignedUrls }
}

describe('residentPhotoUrls (@REQ: ADM-RESIDENT-PHOTO)', () => {
  it('@REQ: ADM-RESIDENT-PHOTO - podpisuje tylko niepuste ścieżki, jednym zapytaniem, z krótkim czasem ważności', async () => {
    const c = client({ data: [{ path: 'o1/r1/a.webp', signedUrl: 'https://x/sig-a', error: null }], error: null })
    const urls = await residentPhotoUrls(c.supabase, ['o1/r1/a.webp', null, undefined, '', 'o1/r1/a.webp'])
    expect(urls).toEqual({ 'o1/r1/a.webp': 'https://x/sig-a' })
    expect(c.from).toHaveBeenCalledWith(RESIDENT_PHOTO_BUCKET)
    expect(c.createSignedUrls).toHaveBeenCalledTimes(1)
    expect(c.createSignedUrls).toHaveBeenCalledWith(['o1/r1/a.webp'], RESIDENT_PHOTO_URL_TTL)
    expect(RESIDENT_PHOTO_BUCKET).toBe('resident-photos')
    expect(RESIDENT_PHOTO_URL_TTL).toBeLessThanOrEqual(3600)
  })

  it('@REQ: ADM-RESIDENT-PHOTO - brak ścieżek: bez zapytania; plik bez dostępu: brak zdjęcia, nie zastępcze', async () => {
    const none = client({ data: [], error: null })
    expect(await residentPhotoUrls(none.supabase, [null, ''])).toEqual({})
    expect(none.createSignedUrls).not.toHaveBeenCalled()

    const denied = client({ data: [{ path: 'o1/r2/b.webp', signedUrl: '', error: 'Object not found' }], error: null })
    expect(await residentPhotoUrls(denied.supabase, ['o1/r2/b.webp'])).toEqual({})
  })

  it('@REQ: SEC-NO-PII-LOGS - błąd storage: brak zdjęć i log bez ścieżek', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = client({ data: null, error: { message: 'o1/r1/a.webp Maria Foto' } })
    expect(await residentPhotoUrls(broken.supabase, ['o1/r1/a.webp'])).toEqual({})
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/o1\/r1|Maria/)
    spy.mockRestore()
  })
})
