/**
 * features.contract.mjs — katalog dużych modułów systemowych i flag delegacji placówki.
 *
 * ŹRÓDŁO PRAWDY (SC-SUP-06, SUP-FEATURE-FLAGS). Kod importuje z @silvercare/contracts,
 * nie przepisuje kluczy, wartości domyślnych ani zależności.
 */

/** Niewyłączalny Rdzeń platformy (Core) — aktywny zawsze niezależnie od flag placówki. */
export const CORE_CAPABILITIES = [
  'auth_sessions',
  'rbac_mfa',
  'organization_isolation',
  'user_profile',
  'mandatory_rodo_audit_logs',
];

/**
 * Katalog 9 dużych modułów systemowych i 2 flag delegacji uprawnień (super_admin → org_admin).
 * Wartości domyślne (defaultEnabled) chronią działające dziś funkcje przed regresją na wspólnej bazie.
 */
export const FEATURE_FLAGS = [
  {
    key: 'module_facility_management',
    kind: 'module',
    label: 'Zarządzanie placówką',
    description: 'Struktura placówki (piętra, sektory, pokoje, łóżka, reguły przydziału), limity miejsc, personel oraz ustawienia placówki.',
    defaultEnabled: true,
    dependsOn: [],
    routes: ['/admin/facility', '/admin/staff', '/admin/settings'],
    apiPrefixes: ['/api/facility', '/api/staff/invite'],
  },
  {
    key: 'module_residents_management',
    kind: 'module',
    label: 'Zarządzanie podopiecznymi',
    description: 'Ewidencja podopiecznych, kreator przyjęcia i import masowy, karta podopiecznego, poziomy opieki, zdarzenia pobytu, kontakty bliskich, rejestr zgód i tablica oddziału.',
    defaultEnabled: true,
    dependsOn: [],
    routes: ['/admin/residents', '/staff', '/staff/residents', '/staff/agenda'],
    apiPrefixes: ['/api/residents', '/api/staff/agenda'],
  },
  {
    key: 'module_voice_and_reports',
    kind: 'module',
    label: 'Nagrywanie i budowanie raportów',
    description: 'Dyktafon PWA, kanał urządzeń i stacja dokująca, potok głosowy z redakcją danych medycznych, raporty dobowe, historia raportów, raporty operacyjne i statystyki.',
    defaultEnabled: true,
    dependsOn: [],
    routes: ['/voice', '/staff/reports', '/admin/reports'],
    apiPrefixes: ['/api/voice'],
  },
  {
    key: 'module_shift_tasks',
    kind: 'module',
    label: 'Lista zadań i praca zmianowa',
    description: 'Definicje zmian, grafik z kierownikiem zmiany, operacyjna lista zadań zmiany, wydruk planu pracy oraz historia i raportowanie realizacji zadań.',
    defaultEnabled: true,
    dependsOn: [],
    routes: ['/admin/shifts', '/staff/shift-tasks', '/staff/shift-plan'],
    apiPrefixes: [],
  },
  {
    key: 'module_audit_compliance',
    kind: 'module',
    label: 'Rozszerzone audytowanie aktywności',
    description: 'Szczegółowy ślad kroków użytkowników i wyświetleń raportów oraz rozszerzona analityka audytowa w placówce (obok niewyłączalnego rejestru RODO).',
    defaultEnabled: false,
    dependsOn: [],
    routes: [],
    apiPrefixes: [],
  },
  {
    key: 'module_family_portal',
    kind: 'module',
    label: 'Portal rodziny i komunikacja',
    description: 'Panel bliskich (pulpit, plan dnia, wiadomości, zgody), zaproszenia dla rodzin, komunikator placówki oraz powiadomienia o publikacji raportu.',
    defaultEnabled: true,
    dependsOn: ['module_residents_management'],
    routes: ['/dashboard', '/agenda', '/messages', '/consents', '/admin/invitations', '/admin/messages'],
    apiPrefixes: ['/api/messages', '/api/admin/messages', '/api/family'],
  },
  {
    key: 'module_documents_contracts',
    kind: 'module',
    label: 'Umowy i dokumenty',
    description: 'Repozytorium szablonów umów, generowanie PDF z ulotnym numerem PESEL, obieg podpisu (odręczny / Profil Zaufany) oraz załączniki umów podopiecznych.',
    defaultEnabled: true,
    dependsOn: ['module_residents_management'],
    routes: ['/admin/contracts'],
    apiPrefixes: ['/api/admin/residents/[id]/contract'],
  },
  {
    key: 'module_finance_budget',
    kind: 'module',
    label: 'Budżetowanie i rentowność',
    description: 'Wycena pokoi i łóżek, katalog usług dodatkowych, źródła finansowania oraz pulpit rentowności placówki (bez fakturowania).',
    defaultEnabled: false,
    dependsOn: ['module_facility_management'],
    routes: ['/admin/budget'],
    apiPrefixes: ['/api/budget'],
  },
  {
    key: 'module_wearables_iot',
    kind: 'module',
    label: 'Opaski i sensory IoT',
    description: 'Parowanie urządzeń noszonych, integracja Polar i bramek BLE oraz prezentacja metryk behawioralnych z zachowaniem granicy MDR.',
    defaultEnabled: true,
    dependsOn: ['module_residents_management'],
    routes: [],
    apiPrefixes: ['/api/polar'],
  },
  {
    key: 'allow_org_admin_report_config',
    kind: 'delegation',
    label: 'Konfiguracja raportów przez Kierownika placówki',
    description: 'Deleguje do Kierownika placówki możliwość konfigurowania aktywnych typów i parametrów raportów operacyjnych własnej placówki.',
    defaultEnabled: false,
    dependsOn: ['module_voice_and_reports'],
    routes: [],
    apiPrefixes: [],
  },
  {
    key: 'allow_org_admin_contract_templates',
    kind: 'delegation',
    label: 'Szablony umów przez Kierownika placówki',
    description: 'Deleguje do Kierownika placówki możliwość tworzenia i wersjonowania szablonów umów własnej placówki.',
    defaultEnabled: false,
    dependsOn: ['module_documents_contracts'],
    routes: [],
    apiPrefixes: [],
  },
];

/** Zasady zarządzania flagami placówki (SC-SUP-06, SUP-FEATURE-FLAGS). */
export const FEATURE_FLAG_POLICY = {
  storageTable: 'organization_feature_flags',
  forbiddenStorage: 'organizations.settings',
  managedBy: ['super_admin'],
  blockImpersonation: true,
  cascadeDisableDependents: true,
  requireParentEnabled: true,
  failClosedUnknownKey: true,
  auditAction: 'ORG_FEATURE_FLAG_UPDATED',
  disabledErrorCode: 'FEATURE_DISABLED_FOR_ORG',
  dependencyErrorCode: 'FEATURE_DEPENDENCY_DISABLED',
  coreAuditImmutable: true,
};
