---
project_name: "Silver Care — Backlog"
trello_board_url: "https://trello.com/b/XB1Hig7g"
last_updated: "2026-10-13T09:45:00"
status: "ON_TRACK"
progress_pct: 96
progress_last_week_pct: 6
eta_remaining: "ok. 10-15h / 2 dni robocze (testy akceptacyjne, konfiguracja kluczy produkcyjnych i audyt pre-prod)"
git_branch: "main"
requires_user_action: true
daily_history:
  - date: "2026-10-05"
    progress: 87
  - date: "2026-10-08"
    progress: 90
  - date: "2026-10-13"
    progress: 96
---

## 🎯 Wymagane działania człowieka
- **Kolejka Code Review: ZAKOŃCZONA ✅** — Wszystkie zaległe PR-y z klastrów 1-4 (w tym #75, #63, #61-#74) oraz najnowsze PR #82 i #83 zostały w 100% zrecenzowane i scalone do gałęzi `main`. W repozytorium jest obecnie **0 otwartych PR-ów**.
- **#146 Infra:** konto API Mistral (EU LLM) i zmienna `EU_LLM_API_KEY` na Vercelu (niezbędna do generowania raportów dla bliskich na produkcji).
- **Karty z listy HUMAN (13):**
  - #152 Pre Prod Audyt.
  - #147 Prezentacja dla KIDO.
  - #149–#151 Cennik i oferta Marconi.
  - Realna referencja umowy DPA Groq (podmiana wartości TESTXXXX w rejestrze dostawców).
- Wdrożenie produkcyjne i publikacja pierwszych raportów do bliskich.

## 🚧 Blokery i Ryzyka
- **Wąskie gardło Code Review: ROZWIĄZANE ✅** — Wszystkie gałęzie scalone, brak blokerów w kodzie i procesie review.
- **Zgody OAuth dla opiekuna prawnego: ROZWIĄZANE ✅** — Wdrożono w PR #63 (`OAUTH-GUARDIAN-CONSENTS`).
- **Klucz EU LLM na Vercelu:** Brak `EU_LLM_API_KEY` blokuje pipeline raportów dla bliskich w środowisku produkcyjnym (na czas testów/demo działa syntetyczne obejście z PR #59).

## 🛠 Ostatnio zrobione (Changelog — 08.10 – 13.10)
- **Scalenie klastrów PR i likwidacja długu review (PR #55–#76, #81–#83):**
  - Scalono klastry: niezależny (#67, #69, #70, #71, #72, #73, #74), zaproszeń rodziny (#64, #68), UI & IAM (#65, #66, #75) oraz bezpieczeństwa Auth/OAuth (#61, #62, #63, #76).
  - Scalono PR #83 (`fix(voice): naprawa wyświetlania transkrypcji i zakończenia nagrania notatki`) z testem E2E Playwright `voice-note.spec.ts` i Page Object Model.
  - Scalono PR #82 (`docs(spec): [SC-NUR-11] wskaźnik wiadomości na pulpicie i odpowiedź głosowa`).
- **Zgody Art. 9 RODO przy Google OAuth (PR #63, #163):**
  - Dodano modal wymuszenia zgód RODO na `/register` dla opiekuna prawnego uwierzytelniającego się przez OAuth, zapis zdarzenia w `consent_ledger` oraz claim zaproszenia `evaluateOAuthInviteClaim`.
- **Zarządzanie kontami personelu i szybka edycja (SC-ADM-15, SC-ADM-16):**
  - Podbito statusy w kanonicznej specyfikacji user stories do ✅ 📝.
- **Higiena repozytorium:**
  - Usunięto wszystkie scalone gałęzie robocze (lokalnie i zdalnie), gałąź `main` zsynchronizowana z `origin/main`.
- **Weryfikacja jakościowa:**
  - Pełna bramka `bash scripts/verify.sh --full` zaliczona: **6/6 ETAPÓW ZIELONYCH (100% PASS)**, 82 pliki testowe, 431 testów logicznych, testy E2E zielone.
- **Stan Trello / PR:**
  - PR Created / In Review: **0 PR-ów** (100% wdrożone do `main`)
  - HUMAN: **13 kart**

## 📋 Rekomendowana sekwencja zadań w Trello (Next Up)
1. **[#152] Pre Prod Audyt & Kontrola Przedwdrożeniowa (`/sc-release-gate`)** — weryfikacja środowiska produkcyjnego i konfiguracji Vercel/Supabase.
2. **[#146] Konfiguracja EU LLM (Mistral API Key)** — uzupełnienie klucza produkcyjnego na Vercelu.
3. **[SC-NUR-11] Work Order & Implementacja wskaźnika wiadomości na dyżurze** — realizacja karty `https://trello.com/c/uD0Yqk5b`.
