<!-- WYGENEROWANE z .claude/CLAUDE.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->
## Gałęzie i wdrożenia

- **Nowe PR-y kierujesz do `staging`** (domyślna gałąź repozytorium). Push na `staging` wdraża podgląd „staging” na Vercelu.
- **`main` = produkcja.** Trafia tam wyłącznie PR promocyjny `staging → main`, scalany commitem scalającym (nie squash), żeby historia obu gałęzi się nie rozjeżdżała.
- **Poprawka pilna na produkcji** idzie PR-em do `main`, a potem od razu `main → staging`, żeby `staging` jej nie cofnął.
- Staging i produkcja korzystają z **tej samej bazy Supabase** — migracja zastosowana „dla stagingu” działa też na produkcji.
