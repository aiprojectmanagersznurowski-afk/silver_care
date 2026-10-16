# Work Order: ADM-INVITATIONS-ACTIONS-MANAGEMENT

## Cel
Wdrożenie pełnego zarządzania akcjami zaproszeń (ponowienie wysyłki, kopiowanie linku, unieważnienie) w rejestrze `/admin/invitations`, dodanie bezpośredniego skrótu zaproszenia na karcie podopiecznego (`/admin/residents/[id]`) oraz standaryzacja nazewnictwa na kanoniczne słowo „podopieczny”.

## Zakres wdrożenia
1. **Rejestr zaproszeń (`/admin/invitations` & `InvitationsTable.tsx`):**
   - Kolumna „Akcje” w tabeli.
   - Akcja „Kopiuj link” (kopiowanie linku rejestracyjnego z tokenem do schowka).
   - Akcja „Ponów wysyłkę” (ponowna wysyłka wiadomości z zaproszeniem).
   - Akcja „Odwołaj zaproszenie” (unieważnienie aktywnego zaproszenia przez API `PATCH /api/family/invite`).
2. **Karta podopiecznego (`/admin/residents/[id]`):**
   - Bezpośredni przycisk „Zaproś bliskiego” w sekcji Bliscy z automatycznie wybranym `resident_id`.
3. **Standaryzacja słownictwa (`InviteFamilyDialog.tsx` & widoki zaproszeń):**
   - Zastąpienie wszelkich wystąpień słowa „pensjonariusz” kanoniczną formą „podopieczny”.
4. **Endpoint API (`/api/family/invite`):**
   - Obsługa metody `PATCH` dla akcji `revoke` oraz `resend`.
