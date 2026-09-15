# Work Order: Usunięcie podatności user_metadata w politykach RLS (SEC-FIX-LINT-0015)

## Wymaganie
Podatność CWE-284 / Supabase Lint 0015 (rls_references_user_metadata):
Polityki RLS w tabelach public.voice_draft_notes, public.daily_logs oraz public.daily_reports dopuszczały sprawdzanie roli personelu z user_metadata ->> 'role'.
Ponieważ user_metadata może być manipulowane przez użytkownika końcowego z poziomu przeglądarki (np. konto o roli family), pozwalało to na nieuprawnioną eskalację uprawnień.

Wymagania powiązane w kontrakcie:
- VOICE-DRAFT-ISOLATION: Brudnopis personelu jest niedostępny dla bliskich i osób nieuprawnionych.
- REPORT-APPROVAL: Raporty opiekuńcze mogą być tworzone i modyfikowane wyłącznie przez personel.
- SEC-403-LOGGING: Próby nieautoryzowanego zapisu są blokowane przez RLS.

## Cele
1. Usunąć wszelkie odwołania do user_metadata z polityk RLS:
   - "Staff can create voice draft note" ON public.voice_draft_notes
   - "Staff can read own voice draft note" ON public.voice_draft_notes
   - "Staff can update own voice draft note" ON public.voice_draft_notes
   - "Staff can create daily logs" ON public.daily_logs
   - "Staff can create daily reports" ON public.daily_reports
2. Zastąpić je weryfikacją wyłącznie autoryzowanego app_metadata ->> 'role'.
3. Utworzyć test RLS demonstrujący próbę ataku przez manipulację user_metadata = { role: 'nurse' } przy app_metadata = { role: 'family' }, potwierdzając zablokowanie operacji (błąd RLS).
4. Utrzymać pełną zieloną bramkę weryfikacyjną.
