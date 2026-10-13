# Instrukcja i kolejność scalania PR-ów dla Darka (Merge Cheat Sheet)

Data aktualizacji: **13.10.2026, 19:50**  
Status: **Wszystkie poprzednie PR-y z klastrów 1-4 oraz PR #82 i #83 zostały w 100% zrecenzowane i scalone do gałęzi `main`.**  
W repozytorium oczekują obecnie **2 otwarte PR-y** w sekcji Code Review:

1. **[PR #84](https://github.com/aiprojectmanagersznurowski-afk/silver_care/pull/84)** — `feat(staff): wskaźnik nieodpowiedzianych wiadomości i dyktowanie odpowiedzi głosowej [SC-NUR-11]`
2. **[PR #85](https://github.com/aiprojectmanagersznurowski-afk/silver_care/pull/85)** — `fix(ui): popraw odstepy kart logowania i profilu oraz obsluz logo_dark w dark mode`

Oba PR-y przeszły pełną bramkę jakościową `bash scripts/verify.sh --full` (6/6 ZIELONA) oraz 100% testów jednostkowych i E2E.

---

## 🚀 Zalecana kolejność scalania przez Darka

Zaleca się scalenie w kolejności od funkcji biznesowej do globalnego bugfixu UI:

### KROK 1: PR #84 (SC-NUR-11: Wskaźnik wiadomości i odpowiedź głosowa)
- Gałąź: `feature/nur-unanswered-messages-voice-reply`
- Dotyczy: wskaźnika nieodpowiedzianych wiadomości na pulpicie dyżuru personelu (`/staff`) oraz dyktowania odpowiedzi głosowej w skrzynce wiadomości.
- Testy: 5 testów Vitest (`staff_unanswered_messages.test.ts`) + 3 testy Playwright E2E (`staff-unanswered-messages.spec.ts`).

```bash
# Weryfikacja i scalenie PR #84:
gh pr checkout 84
bash scripts/verify.sh --full
gh pr merge 84 --squash --delete-branch
```

---

### KROK 2: PR #85 (Poprawa odstępów kart logowania/profilu i logo Dark Mode)
- Gałąź: `fix/login-profile-card-layout`
- Dotyczy:
  - Naprawy nachodzenia linii stopki i checkboxa `Zapamiętaj mnie` w oknie logowania (`/login`).
  - Zwiększenia odstępu między polem hasła a przyciskiem `Zmień hasło` w `/settings/profile`.
  - Wprowadzenia uniwersalnego komponentu `Logo.tsx` automatycznie przełączającego `/logo.png` (Light) i `/logo_dark.png` (Dark Mode).

```bash
# Weryfikacja i scalenie PR #85:
git checkout main
git pull origin main
gh pr checkout 85
bash scripts/verify.sh --full
gh pr merge 85 --squash --delete-branch
```

---

### KROK 3: Finalna weryfikacja gałęzi `main`
Po scaleniu obu PR-ów Darek sprawdza spójność gałęzi głównej:

```bash
git checkout main
git pull origin main
bash scripts/verify.sh --full
```

Oczekiwany wynik: **BRAMKA ZIELONA — wszystkie etapy wykonane (6/6).**
