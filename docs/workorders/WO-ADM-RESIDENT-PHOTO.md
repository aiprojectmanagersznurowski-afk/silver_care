# WO: ADM-RESIDENT-PHOTO — Prywatne zdjęcie podopiecznego

## Wymaganie
Story **`[SC-ADM-25]`** (📝 PROPOZYCJA) i **`SC-ADM-20/AC11`** (pola karty edytuje się w oknie „Edytuj”). Wymaganie kontraktowe **`ADM-RESIDENT-PHOTO`** (risk HIGH). Powiązane: `ORG-ISOLATION`, `FAM-RESIDENT-DATA-MINIMIZATION`, `SEC-RETENTION`, `ADM-RESIDENT-CARD-VISIBILITY`.

## Stan zastany (2026-11-17)
- Bucket `avatars` (`20260902224000_avatars_storage.sql`) jest **publiczny**; `residents.avatar_url` trzyma publiczny URL.
- Polityki `storage.objects` dla `avatars`: INSERT/UPDATE/DELETE dla **każdego** `authenticated` (także `family`), bez roli i placówki.
- Zdjęcie wgrywa tylko przestarzały `AddResidentDialog`; okno „Edytuj” i kreator przyjęcia nie mają zdjęcia.
- `avatar_url` czyta ok. 14 miejsc: nagłówek karty, lista podopiecznych (tabela, kafelki, telefon), tablica dyżuru (standardowa karta, szybki obchód), przełączniki podopiecznego, menu konta rodziny, `get_family_resident_overview`, API `/api/residents`, kolumny `admin-resident-columns`, `card-access`.

## Projekt
- **Bucket `resident-photos`**, prywatny. Ścieżka `<organization_id>/<resident_id>/<uuid>.webp`.
- **Polityki `storage.objects`** (bucket `resident-photos`):
  - INSERT / UPDATE / DELETE: rola `org_admin` z `app_metadata`, pierwszy segment ścieżki = `get_jwt_organization_id()`, drugi segment = podopieczny tej placówki (`EXISTS` na `residents`).
  - SELECT: personel tej placówki (`org_admin`, `nurse`) albo bliski z `is_relative_active_or_retained(<resident_id>)`.
- **Kolumna `residents.photo_path`** (ścieżka w buckecie, nie URL). `avatar_url` zostaje do czasu migracji plików, potem do usunięcia osobną migracją.
- **`get_family_resident_overview()`** zwraca `photo_path` zamiast `avatar_url` (dalej 7 kolumn).
- **Podpisane linki:** helper serwerowy `residentPhotoUrls(supabase, paths)` → `createSignedUrls(paths, 3600)` klientem sesji (RLS storage decyduje); brak ścieżki lub błąd = brak zdjęcia (inicjał), bez zdjęcia zastępczego.
- **Upload:** w oknie „Edytuj” (i kreatorze) przez Server Action z kontrolą roli; obraz zmniejszany jak dziś (`optimizeImageForUpload`), stary plik usuwany po udanym zapisie; wpis `RESIDENT_PHOTO_CHANGED` w `audit_logs` bez danych osobowych.

## Kroki (każdy RED → GREEN, ≤3 pliki, osobny PR)
| Krok | Zakres | Test |
|---|---|---|
| 1 | Migracja: bucket, polityki, `photo_path`, RPC rodziny | `tests/db`: kierownik wgrywa do swojej placówki; pielęgniarka, rodzina i kierownik innej placówki nie wgrają/nie usuną; rodzina czyta tylko zdjęcie powiązanego podopiecznego |
| 2 | Helper podpisanych linków | `tests/logic`: link tylko dla ścieżek, brak ścieżki = brak zdjęcia, błąd bez danych w logu |
| 3 | Okno „Edytuj”: wybór zdjęcia + akcja zapisu z audytem | E2E: kierownik dodaje zdjęcie, karta pokazuje je z podpisanego linku |
| 4a–4c | Wyświetlanie: karta i lista; tablica dyżuru; portal rodziny i przełączniki | E2E per obszar |
| 5 | Skrypt przeniesienia istniejących zdjęć (`service_role`, uruchamia człowiek, tryb `--dry-run`) + usunięcie uploadu do `avatars` z `AddResidentDialog` | test logiki skryptu na danych testowych |
| 6 | Migracja usuwająca `avatar_url` i stare polityki `avatars` dla podopiecznych | `tests/db` |

**Kolejność wdrożenia (wspólna baza):** krok 1 zastosować przed wdrożeniem 2–4; krok 5 (przeniesienie plików) po wdrożeniu 4; krok 6 dopiero po 5.

## Poza zakresem
Zdjęcia personelu (`InviteStaffDialog`, ten sam publiczny bucket) — osobna decyzja; polityki zapisu `avatars` dla każdego `authenticated` zostają do kroku 6, więc **do tego czasu** warto zawęzić je doraźnie (osobny mały PR), jeśli kroki 1–6 potrwają dłużej.
