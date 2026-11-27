import { describe, it, expect } from 'vitest'
import { publicAvatarKey, planPhotoMove, summarizePlan } from '../../scripts/lib/resident-photo-migration.mjs'

/**
 * @REQ: ADM-RESIDENT-PHOTO
 * @REQ: SEC-NO-PII-LOGS
 *
 * SC-ADM-25/AC5: przeniesienie istniejących zdjęć podopiecznych z publicznego `avatars` do prywatnego
 * `resident-photos` (<placówka>/<podopieczny>/<plik>). Plan liczony bez efektów ubocznych; raport bez danych osobowych.
 */
const BASE = 'https://faxq.supabase.co/storage/v1/object/public/avatars/'

describe('Plan przeniesienia zdjęć podopiecznych (@REQ: ADM-RESIDENT-PHOTO)', () => {
  it('@REQ: ADM-RESIDENT-PHOTO - klucz pliku tylko z publicznego adresu bucketu avatars', () => {
    expect(publicAvatarKey(`${BASE}residents/res_av_123.webp`)).toBe('residents/res_av_123.webp')
    expect(publicAvatarKey(`${BASE}residents/res%20av.webp?t=1`)).toBe('residents/res av.webp')
    expect(publicAvatarKey('https://example.com/foto.jpg')).toBeNull()
    expect(publicAvatarKey(`${BASE}../secret.webp`)).toBeNull()
    expect(publicAvatarKey(null)).toBeNull()
    expect(publicAvatarKey('')).toBeNull()
  })

  it('@REQ: ADM-RESIDENT-PHOTO - ruch do folderu placówki i podopiecznego; pomija już przeniesione i obce adresy', () => {
    const r = { id: 'r1', organization_id: 'o1', avatar_url: `${BASE}residents/a.jpg`, photo_path: null }
    const move = planPhotoMove(r, () => 'u1')
    expect(move).toEqual({ residentId: 'r1', from: 'residents/a.jpg', to: 'o1/r1/u1.jpg' })
    expect(planPhotoMove({ ...r, photo_path: 'o1/r1/x.webp' }, () => 'u1')).toBeNull()
    expect(planPhotoMove({ ...r, avatar_url: 'https://example.com/a.jpg' }, () => 'u1')).toBeNull()
    expect(planPhotoMove({ ...r, avatar_url: `${BASE}residents/plik` }, () => 'u1')).toEqual({ residentId: 'r1', from: 'residents/plik', to: 'o1/r1/u1.webp' })
  })

  it('@REQ: SEC-NO-PII-LOGS - podsumowanie planu zawiera tylko liczby', () => {
    const rows = [
      { id: 'r1', organization_id: 'o1', avatar_url: `${BASE}residents/a.jpg`, photo_path: null, first_name: 'Maria', last_name: 'Foto' },
      { id: 'r2', organization_id: 'o1', avatar_url: null, photo_path: null, first_name: 'Jan', last_name: 'Bez' },
      { id: 'r3', organization_id: 'o1', avatar_url: `${BASE}residents/c.png`, photo_path: 'o1/r3/c.png', first_name: 'Ewa', last_name: 'Juz' },
    ]
    const summary = summarizePlan(rows, () => 'u')
    expect(summary).toEqual({ total: 3, toMove: 1, alreadyMoved: 1, withoutPhoto: 1, foreignUrl: 0 })
    expect(JSON.stringify(summary)).not.toMatch(/Maria|Foto|r1|avatars/)
  })
})
