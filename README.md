# Silver Care Agent OS

Kit systemu agentowego dla platformy Silver Care: portal rodzin, panel placówki, notatki głosowe, integracja Polar 360.

**Pracujesz w Antigravity?** → `docs/04-ANTIGRAVITY.md`
**Instalacja** → `INSTALL.md`
**Konfiguracja krok po kroku** → `docs/02-SETUP-STEP-BY-STEP.md`
**Co skonfigurować najpierw** → `docs/00-PREREQUISITES.md`
**Osiem decyzji, na których stoi kontrakt** → `docs/01-ADR-decisions.md`

```
contracts/          ← ŹRÓDŁO PRAWDY: role, granica MDR, potok głosowy, integracja, wymagania
tools/              ← bramka: walidator, test mutacyjny, generator, skanery
.claude/            ← Claude Code: 11 agentów, 6 komend, hooki
.agents/            ← Antigravity: generowane z .claude/
.githooks/          ← bramka commitowa, niezależna od IDE
docs/               ← metodyka, decyzje, prerequisites, przewodnik portu
scripts/verify.sh   ← bramka scalająca
AGENTS.md           ← wspólna podstawa dla wszystkich narzędzi
```

## Szybki start

```bash
bash scripts/install-git-hooks.sh   # zrób to najpierw
node tools/sc-validate.mjs          # spójność kontraktów
node tools/sc-selftest.mjs          # 22 reguły blokują swoje mutacje
bash scripts/verify.sh --full       # pełna bramka
```

## Co ten kit pilnuje

| Obszar | Reguła |
|---|---|
| Granica MDR | Bliscy nie widzą parametrów fizjologicznych; żadna metryka nie wyzwala powiadomienia |
| Zgody | Wyraża je pensjonariusz albo opiekun prawny — nigdy dowolny krewny |
| Potok głosowy | Dane medyczne usuwane przed modelem; model nie zgaduje tożsamości |
| Dane osobowe | Brak w logach, w powiadomieniach, w promptach i w zaproszeniach |
| Niezmienialność | Rejestr zgód i rejestr audytowy bez UPDATE i DELETE |
| Rdzeń | Identyfikatory dostawców wyłącznie w warstwie integracyjnej |
| Autonomia | Agent decyduje sam, poza zamkniętą listą decyzji wymagających człowieka |
| Wygląd | Tokeny generowane z kontraktu; tekst 17px, kontrast 4.5:1, bez wykresów oceniających |

Każda z tych reguł ma mutację w `sc-selftest.mjs`, która dowodzi, że reguła potrafi zablokować zmianę.
