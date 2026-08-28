# Zanim ruszy development

Lista rzeczy do skonfigurowania po Twojej stronie. Podzielona na to, co blokuje start, i to, co blokuje pilotaż.

---

## Blokuje start (bez tego agenci nie ruszą)

### Repozytorium
- Repozytorium git dla Silver Care, puste albo istniejące.
- `gh` CLI zalogowane albo token z prawem push i tworzenia pull requestów.
- Po skopiowaniu kitu: `bash scripts/install-git-hooks.sh`.

### Środowisko lokalne
- Node 22 lub nowszy, `pnpm`.
- Antigravity z Gemini 3.1 Pro. Agenci audytujący dostają `pro`, implementujący `flash` — mapowanie w `tools/sc-port-antigravity.mjs`.

### Supabase
- Projekt w regionie **Frankfurt (eu-central-1)**. Region jest wymaganiem, nie preferencją — patrz `INFRA-EU-REGION`.
- **Plan darmowy wystarcza na MVP** (ADR-013). PITR i rozszerzenie `pgAudit` z `TASK-INFRA-01` wymagają planu Pro i są świadomie odłożone (`INFRA-PITR` ma status `DEFERRED`) — rozliczalność operacji wrażliwych w pilotażu zapewnia tabela `audit_logs` budowana przez aplikację (`SEC-AUDIT-APPEND-ONLY`), która działa na darmowym planie bez dodatkowego kosztu.
- Zapisz: `Project URL`, `anon key`, `service_role key`, connection string.

### Zmienne środowiskowe
```
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # wyłącznie po stronie serwera
POLAR_CLIENT_ID=
POLAR_CLIENT_SECRET=
POLAR_REDIRECT_URI=
GROQ_API_KEY=                    # wyłącznie po stronie serwera, nigdy w warstwie klienta
PESEL_HASH_SALT=                # sól nie leży w tym samym miejscu co hash
LLM_API_KEY=
SMS_PROVIDER_KEY=
EMAIL_PROVIDER_KEY=
```

Sekrety trzymaj w menedżerze sekretów Supabase i Vercela. Klucz w kodzie to typowy błąd narzędzi agentowych i bramka go blokuje, ale menedżer jest właściwym miejscem.

---

## Blokuje pilotaż (możesz zacząć bez tego, nie możesz wdrożyć)

### Polar AccessLink
- Konto deweloperskie, `client_id` i `client_secret`.
- Scope `accesslink.read_all`, endpoint tokenu `https://polarremote.com/v2/oauth2/token`.
- **Znany punkt zatrzymania z Twojego wcześniejszego proof of concept:** wymiana kodu na token wymaga nagłówka `Authorization: Basic base64(client_id:client_secret)`, a nie danych klienta w ciele żądania. Zapisane w `OAUTH_CONFIG` w kontrakcie integracji.
- Umowa powierzenia z Polar Electro Oy i potwierdzenie lokalizacji przetwarzania.

### Synchronizacja opasek
MVP wskazuje to jako największe ryzyko operacyjne — nie dostęp do API, tylko logistykę synchronizacji piętnastu do dwudziestu pięciu opasek bez udziału personelu. Potrzebny hub Polar albo tablet z Polar Flow w części wspólnej. To temat pierwszego proof of concept, nie kodu.

### Dostawcy zewnętrzni
- **Model językowy**: dostawca z umową powierzenia i brakiem retencji zapytań, przetwarzanie w Unii. Do potwierdzenia którego wybierasz.
- **SMS**: dostawca z Europejskiego Obszaru Gospodarczego.
- **E-mail**: Resend albo Postmark w regionie EU.
- **Transkrypcja**: **Groq** (ADR-009). Konto na GroqCloud, darmowy poziom wystarcza na całą skalę MVP (2000 żądań/dzień, 8h audio/dzień). Trzy kroki przed pierwszym wdrożeniem:
  1. Załóż konto, wygeneruj `GROQ_API_KEY`.
  2. **Ręcznie włącz zerową retencję w panelu Groq.** Nie jest domyślna — to jest krok operacyjny, nie ustawienie kodu, i `INFRA-GROQ-TRANSCRIPTION` zakłada, że go wykonałeś.
  3. Zapisz w rejestrze umów podprocesorów obok Polar — to świadomy wyjątek od reguły EOG (transfer na bazie SCC), udokumentowany w ADR-009, nie przeoczenie.

### Ustalenia prawne
MVP wskazuje dwa tematy do konsultacji, które nie są zadaniem programistycznym:
- Zgody i role: opiekun prawny kontra rodzina, administrator kontra podmiot przetwarzający, ewentualne współadministrowanie.
- Regulamin jasno oddzielający usługę od monitoringu medycznego i systemu ratunkowego.

Kontrakt zakłada rozstrzygnięcie z ADR-003: zgodę wyraża pensjonariusz albo opiekun prawny. Jeżeli prawnik powie inaczej, zmiana idzie przez okno kontraktowe, nie przez poprawkę w kodzie.

---

## Czego celowo nie ma na tej liście

**Docker i lokalny Supabase.** Przydatny, ale niekonieczny — projekt chmurowy wystarczy na start.

**Storybook.** Wymagany przez `NFR-UI-01/AC1`, ale to zależność aplikacji, nie kitu. Doinstaluje się przy pierwszym komponencie.

**Vitest i Playwright.** Kit ich nie zawiera świadomie — narzędzia bramki są bezzależnościowe. Doinstalujesz je przy pierwszym teście: `pnpm add -D vitest @vitest/coverage-v8 @playwright/test`.
