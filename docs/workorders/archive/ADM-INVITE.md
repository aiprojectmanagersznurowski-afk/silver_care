# Work Order: ADM-INVITE

## Metadane
- **Wymaganie:** `ADM-INVITE` (Zaproszenia dla bliskich)
- **Domena:** residents
- **Ryzyko:** HIGH
- **Zależności:** `ADM-RESIDENT-ADD`

## Cel
Umożliwienie personelowi generowania bezpiecznych zaproszeń dla członków rodziny (bliskich). Zaproszenie nie może zawierać w swoim payloadzie / tokenie bezpośrednio danych osobowych i musi posiadać wbudowany cykl życia (wygasanie, unieważnianie). 

## Kryteria Akceptacji (z kontraktu)
1. Treść e-maila (z perspektywy bazy danych: token i wygenerowane zdarzenie) nie zawiera imienia, nazwiska ani PESEL pensjonariusza.
2. Token wygasa po siedmiu dniach.
3. Administrator może unieważnić zaproszenie przed rejestracją.

## Plan Realizacji (Baza Danych - PostgreSQL / Supabase)

### 1. Struktura zaproszeń (Tabela `resident_invitations`)
Utworzenie tabeli na zaproszenia:
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (pełni rolę nietradycyjnego "tokena", niemożliwego do odgadnięcia - nie przesyłamy w nim JWT z danymi pacjenta).
- `organization_id uuid NOT NULL`
- `resident_id uuid NOT NULL REFERENCES residents(id) ON DELETE CASCADE`
- `role text NOT NULL CHECK (role IN ('family', 'legal_guardian'))`
- `expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'` (KA 2)
- `revoked_at timestamptz` (do unieważniania, KA 3)
- `created_at timestamptz NOT NULL DEFAULT now()`

### 2. Polityki RLS
- **SELECT**: `org_admin` widzi zaproszenia dla swojej organizacji.
- **INSERT**: `org_admin` może dodawać zaproszenia.
- **UPDATE**: `org_admin` może aktualizować tylko pole `revoked_at` (by unieważnić), inne pola (szczególnie `resident_id` czy `role`) są zablokowane dla modyfikacji by zachować integralność i ślad audytowy.

### 3. Logika bazy danych (Funkcje)
Aby ułatwić zarządzanie stanem i uniknąć "martwych" (starych) zaproszeń bez akcji:
- Stworzymy RPC `revoke_invitation(p_invitation_id uuid)`, który ustawi `revoked_at = now()`.

*Uwaga: Wysłanie samego e-maila realizowane będzie na warstwie aplikacyjnej (np. Edge Function czy backend), reagującej na INSERT do tej tabeli. W ten sposób treść maila użyje np. ID z tabeli, ale sama logika bazodanowa w ogóle nie emituje danych na zewnątrz.*

### 4. Testy (Vitest)
Dodanie pliku `tests/db/invitations.test.ts`:
- Tworzenie zaproszenia powoduje domyślne ustawienie `expires_at` na 7 dni do przodu.
- Nie można edytować powiązanego rezydenta na aktywnym zaproszeniu (zabezpieczenie RLS).
- Weryfikacja działania RPC `revoke_invitation` - anuluje token (uzupełnia `revoked_at`).

## Otwarte Pytania / WYMAGA DECYZJI
- **WYMAGA DECYZJI:** Z punktu widzenia bezpieczeństwa i RLS, czy po rejestracji rodziny (czyli po konsumpcji tokenu) usuwamy rekord z bazy, czy oznaczamy go jako użyty np. `claimed_at`? Mając na uwadze przyszły ślad audytowy i rozliczanie (co jest filarem Silver Care), polecam dodać kolumnę `claimed_at` i trzymać zużyte zaproszenia do celów audytowych zamiast je fizycznie usuwać (`DELETE`). Rekomenduję to podejście. Zgadzasz się?
