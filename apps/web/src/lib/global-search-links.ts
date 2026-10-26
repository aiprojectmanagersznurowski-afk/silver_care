/**
 * Adresy wyników wyszukiwarki według roli (SC-ADM-17, SC-ADM-20). Pielęgniarka ma kartę podopiecznego
 * w części personelu i nie ma widoku struktury placówki; kierownik i superadmin (w impersonacji) — w części admina.
 */
export function residentCardHref(role: string | undefined, residentId: string): string {
  return role === 'nurse' ? `/staff/residents/${residentId}` : `/admin/residents/${residentId}`
}

/** Pokój lub łóżko: dla pielęgniarki karta podopiecznego w łóżku, a wolne miejsce bez linku (undefined). */
export function facilityHref(role: string | undefined, residentId: string | null | undefined): string | undefined {
  if (role !== 'nurse') return '/admin/facility'
  return residentId ? residentCardHref(role, residentId) : undefined
}
