# Kontrakty Silver Care — wygenerowane

Ten plik powstaje z `contracts/`. Nie edytuj go ręcznie.

## Role (5)

| Rola | Zakres | Opis |
|---|---|---|
| `super_admin` | GLOBAL | Operator platformy Silver Care. Zarządza placówkami, nie czyta treści opieki. |
| `org_admin` | ORGANIZATION | Administrator placówki. Zarządza pensjonariuszami, personelem i powiązaniami rodzin. |
| `nurse` | ORGANIZATION | Personel opiekuńczy. Tworzy notatki, zatwierdza raporty. |
| `legal_guardian` | RESIDENT | Opiekun prawny. JEDYNA rola po stronie bliskich, która może wyrazić zgodę na przetwarzanie danych o zdrowiu. |
| `family` | RESIDENT | Członek rodziny. Odbiorca raportów. NIE może wyrażać ani cofać zgód. |

**Zgodę na dane o zdrowiu mogą wyrazić:** `resident_self`, `legal_guardian`. Rola `family` świadomie poza tą listą (ADR-003).

## Granica MDR — co widzą bliscy (ADR-005, wariant B)

| Metryka | Jednostka | Rodzaj |
|---|---|---|
| `steps_total` | kroki | BEHAVIORAL |
| `active_minutes` | minuty | BEHAVIORAL |
| `sleep_duration_min` | minuty | BEHAVIORAL |
| `sleep_start_time` | godzina | BEHAVIORAL |
| `sleep_end_time` | godzina | BEHAVIORAL |

**Ukryte przed bliskimi (12 pól fizjologicznych):** `heart_rate_bpm`, `resting_heart_rate_bpm`, `min_heart_rate_bpm`, `max_heart_rate_bpm`, `avg_heart_rate_bpm`, `hrv_ms`, `breathing_rate`, `ans_charge`, `recovery_score`, `sleep_score`, `nightly_recharge_status`, `continuity_class`.

Dane są zbierane i dostępne personelowi. Zakaz dotyczy prezentacji bliskim, nie przechowywania.

## Potok głosowy

| Etap | Wykonawca | Wejście | Wyjście |
|---|---|---|---|
| CAPTURE | nurse | audio + resident_id (UUID) | voice_draft_notes |
| TRANSCRIBE | system | audio | transkrypt tekstowy |
| CLASSIFY | system | transkrypt | trzy strumienie |
| REDACT | system | strumień MEDICAL | transkrypt bez danych medycznych |
| GENERATE | llm | transkrypt zredagowany, anonimowy | draft raportu |
| REJOIN | edge_function | draft + resident_id | daily_reports (draft) |
| APPROVE | nurse | draft | daily_reports (published) |

## Powiadomienia (10)

| ID | Wyzwalacz | Odbiorca | Kanały |
|---|---|---|---|
| F1 | `daily_report_published` | FAMILY | SMS, EMAIL |
| F2 | `invitation_sent` | FAMILY | EMAIL |
| F3 | `access_revoked` | FAMILY | EMAIL |
| S1 | `missing_note_evening` | NURSE | IN_APP |
| S2 | `voice_sync_completed` | NURSE | IN_APP |
| S3 | `family_message_received` | NURSE | IN_APP |
| A1 | `device_sync_stale` | ORG_ADMIN | IN_APP, EMAIL |
| A2 | `consent_expiring` | ORG_ADMIN | EMAIL |
| A3 | `ingest_rejected_repeatedly` | ORG_ADMIN | EMAIL |
| X1 | `access_denied_threshold` | SUPER_ADMIN | EMAIL |

**Zakazane wyzwalacze:** `steps_below_threshold`, `heart_rate_anomaly`, `sleep_quality_drop`, `no_activity_detected` — powiadomienie oparte na metryce czyni system narzędziem monitorowania stanu.

## Rejestr pokoi i łóżek (ADR-012)

Hierarchia: organization → floor → room → bed

| Guard | Reakcja na naruszenie |
|---|---|
| `bed_single_occupant` | REJECT |
| `resident_single_bed` | REJECT |
| `inactive_bed_no_assign` | REJECT |
| `archived_resident_no_assign` | REJECT |

W danym momencie co najwyżej jedno przypisanie z unassigned_at = NULL na dane bed_id, i co najwyżej jedno na dane resident_id. Jedno łóżko, jeden aktywny pensjonariusz. Jeden pensjonariusz, jedno aktywne łóżko.

## Autonomia agentów (ADR-010)

| Klasa | Tryb | Kiedy |
|---|---|---|
| `AUTO` | DECIDE_AND_CONTINUE | Decyzja techniczna, odwracalna, bez wpływu na dane osobowe i granice prawne. |
| `AUTO_LOGGED` | DECIDE_AND_RECORD | Decyzja projektowa o trwałych skutkach, ale odwracalna i mieszcząca się w kontrakcie. |
| `ESCALATE` | STOP_AND_ASK | Decyzja nieodwracalna, wiążąca prawnie albo zmieniająca granice bezpieczeństwa. |

**Zawsze pytają człowieka:** `contract_change`, `mdr_boundary`, `medical_category`, `consent_or_legal`, `external_provider`, `gate_relaxation`, `irreversible_data_op`, `production_deploy`, `source_contradiction`.

## System projektowy (ADR-011)

Krój: `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif`

Bazowy rozmiar 17px · minimalny kontrast 4.5:1 · cel dotykowy 48px

## Wymagania (49)

| ID | Domena | Ryzyko | Treść |
|---|---|---|---|
| ORG-ISOLATION | tenancy | HIGH | Każda placówka ma własny organization_id, a wszystkie polityki RLS izolują do niego dane. |
| ORG-PROVISION | tenancy | MEDIUM | Utworzenie placówki tworzy pierwszego org_admin i wysyła mu zaproszenie. |
| SUP-IMPERSONATION | tenancy | HIGH | Super admin może działać jako administrator placówki w celu diagnostyki. |
| ADM-RESIDENT-ADD | residents | HIGH | Administrator dodaje pensjonariusza, przypisuje bliskich i przypisuje łóżko. |
| ADM-FACILITY-MANAGE | facility | MEDIUM | Administrator zarządza rejestrem pokoi i łóżek placówki. |
| ADM-BED-ASSIGNMENT | facility | HIGH | Jedno łóżko ma co najwyżej jednego aktywnego pensjonariusza; jeden pensjonariusz ma co najwyżej jedno aktywne łóżko. |
| ADM-FACILITY-OCCUPANCY | facility | MEDIUM | Administrator widzi obłożenie pokoi bez ręcznego liczenia. |
| ADM-INVITE | residents | HIGH | Zaproszenie dla bliskiego jest bezpieczne i nie ujawnia danych osobowych. |
| ADM-ARCHIVE | residents | HIGH | Archiwizacja odcina dostęp bliskim bez niszczenia śladu audytowego. |
| SEC-MFA-STAFF | security | HIGH | Personel loguje się z drugim składnikiem; rodziny bez MFA. |
| SEC-SESSION | security | MEDIUM | Użytkownik zarządza swoimi sesjami, a sesje personelu wygasają po bezczynności. |
| CONSENT-GRANTOR | consent | HIGH | Zgodę na przetwarzanie danych o zdrowiu może wyrazić wyłącznie pensjonariusz lub jego opiekun prawny. |
| CONSENT-REVOKE | consent | HIGH | Cofnięcie zgody natychmiast zatrzymuje przetwarzanie w danym celu. |
| CONSENT-LEDGER-IMMUTABLE | consent | HIGH | Rejestr zgód jest niezmienialny. |
| MDR-NO-PHYSIO-TO-FAMILY | presentation | HIGH | Bliscy widzą metryki behawioralne; parametry fizjologiczne nie mają ścieżki do portalu rodziny. |
| MDR-NO-INTERPRETATION | presentation | HIGH | System opisuje fakty o zachowaniu i nie ocenia stanu zdrowia. |
| MDR-NO-METRIC-ALARM | presentation | HIGH | Żadna metryka nie wyzwala powiadomienia. |
| MDR-VOCABULARY | presentation | MEDIUM | W warstwie widocznej dla użytkownika nie występuje słowo „pacjent" ani język kliniczny. |
| UI-FOUR-STATES | presentation | MEDIUM | Każdy komponent prezentujący dane ma cztery stany. |
| UI-ACCESSIBILITY | presentation | MEDIUM | Interfejs spełnia WCAG 2.1 na poziomie AA. |
| VOICE-ZERO-GUESSING | voice | HIGH | Model nigdy nie ustala tożsamości pensjonariusza z nagrania. |
| VOICE-MEDICAL-STRIP | voice | HIGH | Dane medyczne są usuwane z transkryptu przed wysłaniem do modelu. |
| VOICE-DRAFT-ISOLATION | voice | HIGH | Brudnopis personelu jest niedostępny dla bliskich. |
| VOICE-RETENTION | voice | MEDIUM | Surowe nagrania są usuwane po trzydziestu dniach. |
| VOICE-OFFLINE | voice | MEDIUM | Dyktafon działa bez łączności i synchronizuje się po jej odzyskaniu. |
| VOICE-FOLLOWUP | voice | MEDIUM | Przy zbyt ubogiej notatce asystent dopytuje zamiast uzupełniać treść samodzielnie. |
| REPORT-APPROVAL | reports | HIGH | Raport trafia do bliskich dopiero po zatwierdzeniu przez personel. |
| REPORT-AI-FEEDBACK | reports | MEDIUM | Personel może zgłosić błąd w raporcie wygenerowanym przez AI. |
| INT-CORE-DECOUPLED | integration | HIGH | Identyfikatory zewnętrzne nie występują na tabelach rdzenia. |
| INT-INGEST-PRECONDITIONS | integration | HIGH | Ingest zapisuje dane wyłącznie przy spełnieniu wszystkich warunków wstępnych. |
| INT-NORMALIZATION | integration | MEDIUM | Dane dostawcy są normalizowane do pól kanonicznych. |
| INT-SYNC-STALENESS | integration | MEDIUM | Brak synchronizacji dłuższy niż próg jest komunikowany opisowo. |
| FAM-ONBOARDING | family | MEDIUM | Bliski zakłada konto z zaproszenia i akceptuje zgody. |
| FAM-DASHBOARD | family | MEDIUM | Bliski widzi najnowszy zatwierdzony raport dnia. |
| FAM-MULTI-RESIDENT | family | MEDIUM | Bliski powiązany z kilkoma pensjonariuszami przełącza kontekst. |
| FAM-MESSAGES | family | MEDIUM | Bliski zostawia wiadomość dla personelu bez dzwonienia na dyżurkę. |
| FAM-AGENDA | family | MEDIUM | Bliski widzi plan dnia pensjonariusza. |
| NUR-BOARD | staff | MEDIUM | Personel widzi tablicę pensjonariuszy ze statusem notatek. |
| NUR-AGENDA | staff | MEDIUM | Personel zarządza planem dnia placówki. |
| NTF-REPORT-READY | notifications | MEDIUM | Bliscy otrzymują powiadomienie o dostępności raportu. |
| NTF-NO-PII | notifications | HIGH | Treść powiadomienia nie zawiera danych osobowych ani zdrowotnych. |
| SEC-NO-PII-LOGS | security | HIGH | Dane osobowe i zdrowotne nie trafiają do logów ani do monitoringu. |
| SEC-AUDIT-APPEND-ONLY | security | HIGH | Rejestr audytowy (tabela audit_logs, budowana przez aplikację) jest niezmienialny. NIE zależy od PITR/pgAudit z INFRA-PITR — to dwa różne mechanizmy, pierwszy działa na planie darmowym Supabase, drugi wymaga planu Pro (patrz ADR-013). |
| SEC-403-LOGGING | security | HIGH | Odmowy dostępu są rejestrowane i alarmują przy serii prób. |
| SEC-PESEL-HASH | security | HIGH | PESEL przechowywany wyłącznie jako hash z solą. |
| SEC-RETENTION | security | MEDIUM | System ma zautomatyzowaną politykę retencji danych archiwalnych. |
| INFRA-PITR | infra | MEDIUM | Baza produkcyjna ma odtwarzanie do punktu w czasie i rozszerzenie pgAudit. |
| INFRA-EU-REGION | infra | HIGH | Dane nie opuszczają Europejskiego Obszaru Gospodarczego, poza jawnie udokumentowanymi wyjątkami. |
| INFRA-GROQ-TRANSCRIPTION | infra | HIGH | Transkrypcja surowego audio odbywa się przez Groq (USA, transfer na bazie SCC) wyłącznie na etapie TRANSCRIBE, przed redakcją danych medycznych. |
