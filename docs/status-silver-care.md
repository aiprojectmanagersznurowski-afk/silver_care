---
project_name: "Silver Care — Backlog"
trello_board_url: "https://trello.com/b/XB1Hig7g"
last_updated: "2026-10-14T09:30:00"
status: "ON_TRACK"
progress_pct: 99
progress_last_week_pct: 9
eta_remaining: "ok. 4-8h / 1 dzień roboczy (Code Review PR #86, audyt pre-prod, konfiguracja kluczy produkcyjnych)"
git_branch: "feature/nur-unanswered-messages-voice-reply"
requires_user_action: true
daily_history:
  - date: "2026-10-05"
    progress: 87
  - date: "2026-10-08"
    progress: 90
  - date: "2026-10-13"
    progress: 96
  - date: "2026-10-14"
    progress: 99
---

## 🎯 Wymagane działania człowieka
- **Code Review i Merge PR #86 przez partnera (Darek):**
  - Pull Request #86 zawiera komplet zrealizowanych historyjek użytkownika (wypis pensjonariusza `SC-ADM-19`, command palette `SC-ADM-17`, zapamiętywanie widoków `SC-ADM-18`, routing zaproszeń `SC-ADM-08`/`SC-FAM-01`, wskaźniki dyżuru `SC-NUR-11`, demo fallback Groq `ADR-015`).
  - Zgodnie z `AGENTS.md` autor nie wykonuje merge do `main` — scalenia dokonuje druga osoba po review.
- **#146 Infra:** konto API Mistral (EU LLM) i zmienna `EU_LLM_API_KEY` na Vercelu (do generowania raportów dla bliskich na środowisku produkcyjnym).
- **Karty z listy HUMAN:**
  - #152 Pre Prod Audyt & Kontrola Przedwdrożeniowa (`/sc-release-gate`).
  - #147 Prezentacja dla KIDO.
  - #149–#151 Cennik i oferta Marconi.
  - Realna referencja umowy DPA Groq (podmiana wartości TESTXXXX w rejestrze dostawców).
- Wdrożenie produkcyjne i publikacja pierwszych raportów do bliskich.

## 🚧 Blokery i Ryzyka
- **Wąskie gardło Code Review: ROZWIĄZANE ✅** — Wszystkie wcześniejsze PR-y scalone; bieżący PR #86 z pełnym zestawem testów i zieloną bramką (6/6).
- **Zgody OAuth dla opiekuna prawnego: ROZWIĄZANE ✅** — Wdrożono w PR #63 (`OAUTH-GUARDIAN-CONSENTS`).
- **Klucz EU LLM na Vercelu:** Na czas testów/demo działa odporny fallback Groq Whisper + LLM (`ADR-015`); do produkcji wymagany docelowy `EU_LLM_API_KEY`.

## 🛠 Ostatnio zrobione (Changelog — 14.10)
- **Kompletna realizacja zaległych User Stories z Backlogu:**
  - **`[SC-ADM-19]` Cykl życia pensjonariusza:** Zintegrowany proces wypisu, rejestracja zgonu, powody rozwiązania umowy, atomowe zwalnianie łóżek (`unassigned_at = now()`) i wgląd read-only dla rodziny.
  - **`[SC-ADM-17]` Global Command Palette (Spotlight `Cmd+K`):** Pełnofunkcyjna wyszukiwarka globalna w panelu admina i personelu z filtrami kategorii, obsługą klawiatury i 4 stanami UI.
  - **`[SC-ADM-18]` Trwałe preferencje widoku UI:** Uniwersalny hook `useViewPreference` z bezpiecznym SSR, zapamiętywaniem w `localStorage` i integracją w strukturze placówki, tablicy personelu i zarządzaniu organizacjami.
  - **`[SC-ADM-08] / [SC-FAM-01]` Bezpieczny routing zaproszeń:** Obsługa `/accept-invite` z automatycznym routingiem tokenów rodziny do `/register`, ochrona przed Open Redirect (`validateRedirectUrl`) i 4 stany interfejsu.
  - **`[SC-NUR-11]` Wiadomości dyżuru:** Wskaźnik oczekujących wiadomości na kafelkach podopiecznych, filtr obchodu oraz dyktowanie odpowiedzi głosowej personelu.
  - **`[SC-ADM-09]` Zarządzanie siecią placówek:** Formalnie zaparkowane poza MVP (zarządzanie siecią realizuje `super_admin`).
- **Weryfikacja jakościowa:**
  - Pełna bramka `bash scripts/verify.sh --full`: **6/6 ETAPÓW ZIELONYCH (100% PASS)**.
  - Testy jednostkowe: **91 plików, 496/496 testów PASS**.
  - Testy E2E Playwright: **100% PASS** (`onboarding.spec.ts`, `global-search-command-palette.spec.ts`, `resident-discharge.spec.ts`, `voice-note.spec.ts`).
  - Build Next.js: **0 błędów**.

## 📋 Rekomendowane następne kroki
1. **Zatwierdzenie i scalenie PR #86 do `main` przez Darka** (Code Review).
2. **Uruchomienie procedury przedwydaniowej (`/sc-release-gate`)** w celu formalnego odbioru release'u pilotażowego.
