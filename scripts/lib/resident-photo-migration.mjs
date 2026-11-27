/**
 * Plan przeniesienia zdjęć podopiecznych z publicznego bucketu `avatars` do prywatnego `resident-photos`
 * (SC-ADM-25/AC5, WO-ADM-RESIDENT-PHOTO krok 5). Funkcje bez efektów ubocznych — skrypt
 * scripts/migrate-resident-photos.mjs wykonuje plan.
 */

const PUBLIC_PREFIX = '/storage/v1/object/public/avatars/';
const EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'];

/** Klucz pliku w `avatars` z publicznego adresu; obcy adres, ścieżka z `..` albo pusta wartość = null. */
export function publicAvatarKey(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const idx = parsed.pathname.indexOf(PUBLIC_PREFIX);
  if (idx === -1) return null;
  const key = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_PREFIX.length));
  if (!key || key.split('/').some((part) => part === '..' || part === '')) return null;
  return key;
}

/** Ruch pliku dla podopiecznego albo null (już przeniesiony, bez zdjęcia, obcy adres). */
export function planPhotoMove(resident, newId) {
  if (resident.photo_path) return null;
  const from = publicAvatarKey(resident.avatar_url);
  if (!from) return null;
  const ext = (from.split('.').pop() || '').toLowerCase();
  const safeExt = EXTENSIONS.includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'webp';
  return { residentId: resident.id, from, to: `${resident.organization_id}/${resident.id}/${newId()}.${safeExt}` };
}

/** Podsumowanie planu wyłącznie liczbami (bez identyfikatorów, nazwisk i ścieżek). */
export function summarizePlan(residents, newId) {
  const summary = { total: residents.length, toMove: 0, alreadyMoved: 0, withoutPhoto: 0, foreignUrl: 0 };
  for (const r of residents) {
    if (r.photo_path) summary.alreadyMoved++;
    else if (!r.avatar_url) summary.withoutPhoto++;
    else if (planPhotoMove(r, newId)) summary.toMove++;
    else summary.foreignUrl++;
  }
  return summary;
}
