---
description: Wylistuj przypisane issues, wybierz jedno do refinementu i po komendzie start odpal pełną automatyzację do PR
---

Uruchom procedurę ze skilla `auto-issue` (`.agents/skills/auto-issue/SKILL.md`) dla argumentów: $ARGUMENTS

Obowiązkowa kolejność 3 etapów:
1. **`auto_issue` (Pre-flight):** Uruchom `node tools/sc-auto-queue.mjs --include-codex`, zweryfikuj czy lokalny Codex odpowiada oraz pokaż pełną listę wszystkich otwartych zadań przypisanych do mnie (zmapowanych na `docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md`). Poproś o wybór **jednego** numeru issue. Nic nie zmieniaj w kodzie ani w gałęziach.
2. **Refinement (Read-only):** Po wyborze jednego issue przeczytaj jego treść, komentarze (`gh issue view`) i powiązany kod. Ustal ze mną zakres, pliki, wymagania `@REQ`, testy (unit / Playwright POM) oraz ewentualne ryzyka kontraktowe/MDR/RODO. Pokaż podsumowanie refinementu i czekaj na słowo **`start`**.
3. **`start` (Pełna autonomia do PR):** Dopiero po moim `start` odpal `run_workflow` ze skryptem `.agents/skills/auto-issue/scripts/auto_issue.py`, przekazując `issue`, `base_branch` (z pre-flight), `reviewer: "aiprojectmanagersznurowski-afk"` oraz `refined_spec`. Zero pytań pośrednich aż do otwarcia Pull Requesta (nigdy nie rób merge).
