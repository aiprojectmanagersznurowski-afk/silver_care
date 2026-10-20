# Work Order: Dopasowanie UI do szablonu shadcn-admin (UI-TEMPLATE-ALIGNMENT)

## Metadane
- **Wymagania:** `UI-TEMPLATE-ALIGNMENT` (nowe), `UI-ACCESSIBILITY`, `MDR-NO-PHYSIO-TO-FAMILY`
- **ADR:** ADR-014 (skala szablonu 14px/32px, poluzowanie `R24-design-a11y`), decyzja Michała 2026-10-05
- **Wzorzec:** `UI/next-shadcn-admin-dashboard-v1 (1)` (Studio Admin, styl `radix-nova`; aplikacja używa `base-nova` — ta sama rodzina wizualna na Base UI)
- **Trello:** „Do poprawki UI" (zwijany pasek boczny), „Audyt UI"
- **Ryzyko:** MEDIUM — zmiana wyglądu całej aplikacji, obniżenie progu czytelności

## Zakres i podział na PR-y

### PR 1 — fundament (ten PR)
1. Bramka: progi `R24` 14px / 12px / 32px, mutacja selftestu, codegen tokenów z prefiksem `--sc-` i trybem ciemnym przez `.dark` (`AUTO-2026-10-05-ui-tokens.md`).
2. Kontrakt: skala typografii szablonu, zaokrąglenie bazowe 10px, cel dotykowy 32px, paleta rozszerzona o tokeny shadcn, paletę portalu bliskich i `chart-1…5`.
3. `globals.css`: import `tokens.css`, zmienne motywu shadcn wskazują `--sc-*`, zero kolorów wpisanych ręcznie.
4. Komponenty szablonu w `components/ui` (base-nova): sidebar, table, tabs, select, field, empty, chart, scroll-area, collapsible, popover, progress, pagination, toggle-group, input-group, alert, kbd, textarea, switch.
5. Powłoka: `SidebarProvider` + `Sidebar collapsible="icon"` + nagłówek z `SidebarTrigger` w panelu administratora i personelu; stan zwinięcia w ciasteczku `sidebar_state`. Na telefonie pasek otwiera się jako panel (`Sheet`) — usunięte `AdminMobileHeader` i `StaffMobileHeader`.
6. `.gitignore`: `UI/` → `/UI/` (na macOS ignorował też `apps/web/src/components/ui/`).

### PR 2 — panel administratora
Widoki `app/(admin)` i komponenty: tabele (`UserTable`, `AuditLogTable`, lista pensjonariuszy, `RoomList`, `BedList`) na `ui/table`; filtry na `select`/`tabs`/`toggle-group`; formularze dialogów na `field`; stany puste na `empty`; statystyki na `chart` (tylko statystyki placówki).

### PR 3 — panel personelu
`StaffBoardClient`, `AgendaView`, `StaffMessagesInbox`, `BulkReportApprover`, `StaffCommandPalette`, potok głosowy — karty i przyciski z `ui`, usunięcie kolorów niosących ocenę (`emerald`/`rose`/`amber` przy pensjonariuszu).

### PR 4 — portal bliskich i ekrany uwierzytelniania
`FamilyHeader`, `FamilyDashboardClient`, `DailySummaryHero`, `ReportCard`, logowanie, rejestracja, profil. Bez wykresów trendu (ADR-005).

## Kryteria akceptacji (PR 1)
- **AC1** `globals.css` importuje `tokens.css`; brak literałów kolorów; zmienne shadcn → `var(--sc-*)`; każdy użyty token istnieje w kontrakcie.
- **AC2** Komponenty szablonu istnieją i używają Base UI (bez Radix).
- **AC3** Panel administratora i personelu: pasek boczny zwija się do ikon przyciskiem w nagłówku, nawigacja działa w trybie ikon, stan przetrwa przeładowanie (E2E `e2e/roles/app-shell.spec.ts`).
- **AC4** `ui/chart` importowany wyłącznie w statystykach placówki panelu administratora.

## Komendy
```bash
node tools/sc-phase.mjs contract|red|green
bash scripts/verify.sh --full
pnpm test:e2e
```
