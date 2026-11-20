// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const CORE_CAPABILITIES = [
  "auth_sessions",
  "rbac_mfa",
  "organization_isolation",
  "user_profile",
  "mandatory_rodo_audit_logs"
] as const;

export const FEATURE_FLAGS = [
  {
    "key": "module_facility_management",
    "kind": "module",
    "label": "Zarządzanie placówką",
    "description": "Struktura placówki (piętra, sektory, pokoje, łóżka, reguły przydziału), limity miejsc, personel oraz ustawienia placówki.",
    "defaultEnabled": true,
    "dependsOn": [],
    "routes": [
      "/admin/facility",
      "/admin/staff",
      "/admin/settings"
    ],
    "apiPrefixes": [
      "/api/facility",
      "/api/staff/invite"
    ]
  },
  {
    "key": "module_residents_management",
    "kind": "module",
    "label": "Zarządzanie podopiecznymi",
    "description": "Ewidencja podopiecznych, kreator przyjęcia i import masowy, karta podopiecznego, poziomy opieki, zdarzenia pobytu, kontakty bliskich, rejestr zgód i tablica oddziału.",
    "defaultEnabled": true,
    "dependsOn": [],
    "routes": [
      "/admin/residents",
      "/staff",
      "/staff/residents",
      "/staff/agenda"
    ],
    "apiPrefixes": [
      "/api/residents",
      "/api/admin/residents",
      "/api/staff/agenda"
    ]
  },
  {
    "key": "module_voice_and_reports",
    "kind": "module",
    "label": "Nagrywanie i budowanie raportów",
    "description": "Dyktafon PWA, kanał urządzeń i stacja dokująca, potok głosowy z redakcją danych medycznych, raporty dobowe, historia raportów, raporty operacyjne i statystyki.",
    "defaultEnabled": true,
    "dependsOn": [],
    "routes": [
      "/voice",
      "/staff/reports",
      "/admin/reports"
    ],
    "apiPrefixes": [
      "/api/voice"
    ]
  },
  {
    "key": "module_shift_tasks",
    "kind": "module",
    "label": "Lista zadań i praca zmianowa",
    "description": "Definicje zmian, grafik z kierownikiem zmiany, operacyjna lista zadań zmiany, wydruk planu pracy oraz historia i raportowanie realizacji zadań.",
    "defaultEnabled": true,
    "dependsOn": [],
    "routes": [
      "/admin/shifts",
      "/staff/shift-tasks",
      "/staff/shift-plan"
    ],
    "apiPrefixes": []
  },
  {
    "key": "module_audit_compliance",
    "kind": "module",
    "label": "Rozszerzone audytowanie aktywności",
    "description": "Szczegółowy ślad kroków użytkowników i wyświetleń raportów oraz rozszerzona analityka audytowa w placówce (obok niewyłączalnego rejestru RODO).",
    "defaultEnabled": false,
    "dependsOn": [],
    "routes": [],
    "apiPrefixes": []
  },
  {
    "key": "module_family_portal",
    "kind": "module",
    "label": "Portal rodziny i komunikacja",
    "description": "Panel bliskich (pulpit, plan dnia, wiadomości, zgody), zaproszenia dla rodzin, komunikator placówki oraz powiadomienia o publikacji raportu.",
    "defaultEnabled": true,
    "dependsOn": [
      "module_residents_management"
    ],
    "routes": [
      "/dashboard",
      "/agenda",
      "/messages",
      "/consents",
      "/admin/invitations",
      "/admin/messages"
    ],
    "apiPrefixes": [
      "/api/messages",
      "/api/admin/messages",
      "/api/admin/residents/[id]/messages",
      "/api/family",
      "/api/residents/[id]/report/latest",
      "/api/residents/[id]/agenda"
    ]
  },
  {
    "key": "module_documents_contracts",
    "kind": "module",
    "label": "Umowy i dokumenty",
    "description": "Repozytorium szablonów umów, generowanie PDF z ulotnym numerem PESEL, obieg podpisu (odręczny / Profil Zaufany) oraz załączniki umów podopiecznych.",
    "defaultEnabled": true,
    "dependsOn": [
      "module_residents_management"
    ],
    "routes": [
      "/admin/contracts"
    ],
    "apiPrefixes": [
      "/api/admin/residents/[id]/contract"
    ]
  },
  {
    "key": "module_finance_budget",
    "kind": "module",
    "label": "Budżetowanie i rentowność",
    "description": "Wycena pokoi i łóżek, katalog usług dodatkowych, źródła finansowania oraz pulpit rentowności placówki (bez fakturowania).",
    "defaultEnabled": false,
    "dependsOn": [
      "module_facility_management"
    ],
    "routes": [
      "/admin/budget"
    ],
    "apiPrefixes": [
      "/api/budget"
    ]
  },
  {
    "key": "module_wearables_iot",
    "kind": "module",
    "label": "Opaski i sensory IoT",
    "description": "Parowanie urządzeń noszonych, integracja Polar i bramek BLE oraz prezentacja metryk behawioralnych z zachowaniem granicy MDR.",
    "defaultEnabled": true,
    "dependsOn": [
      "module_residents_management"
    ],
    "routes": [],
    "apiPrefixes": [
      "/api/polar"
    ]
  },
  {
    "key": "allow_org_admin_report_config",
    "kind": "delegation",
    "label": "Konfiguracja raportów przez Kierownika placówki",
    "description": "Deleguje do Kierownika placówki możliwość konfigurowania aktywnych typów i parametrów raportów operacyjnych własnej placówki.",
    "defaultEnabled": false,
    "dependsOn": [
      "module_voice_and_reports"
    ],
    "routes": [],
    "apiPrefixes": []
  },
  {
    "key": "allow_org_admin_contract_templates",
    "kind": "delegation",
    "label": "Szablony umów przez Kierownika placówki",
    "description": "Deleguje do Kierownika placówki możliwość tworzenia i wersjonowania szablonów umów własnej placówki.",
    "defaultEnabled": false,
    "dependsOn": [
      "module_documents_contracts"
    ],
    "routes": [],
    "apiPrefixes": []
  }
] as const;

export const FEATURE_FLAG_POLICY = {
  "storageTable": "organization_feature_flags",
  "forbiddenStorage": "organizations.settings",
  "managedBy": [
    "super_admin"
  ],
  "writePathPolicy": "RPC_ONLY",
  "impersonationVerification": "APP_COOKIE_AND_DB_SESSION",
  "rlsEnforcementRequired": true,
  "multiFlagRoutePolicy": "REQUIRE_ALL_MATCHING",
  "hasFeatureExecuteRoles": [
    "authenticated",
    "service_role"
  ],
  "hasFeatureCrossTenantDenied": true,
  "blockImpersonation": true,
  "cascadeDisableDependents": true,
  "requireParentEnabled": true,
  "failClosedUnknownKey": true,
  "auditAction": "ORG_FEATURE_FLAG_UPDATED",
  "disabledErrorCode": "FEATURE_DISABLED_FOR_ORG",
  "dependencyErrorCode": "FEATURE_DEPENDENCY_DISABLED",
  "coreAuditImmutable": true
} as const;

export type FeatureFlagDefinition = typeof FEATURE_FLAGS[number];
export type FeatureKey = FeatureFlagDefinition['key'];
export type FeatureFlagKind = FeatureFlagDefinition['kind'];

export const FEATURE_FLAG_KEYS = FEATURE_FLAGS.map((f) => f.key) as readonly FeatureKey[];

export const FEATURE_FLAGS_BY_KEY = Object.fromEntries(
  FEATURE_FLAGS.map((f) => [f.key, f])
) as Record<FeatureKey, FeatureFlagDefinition>;

export function isFeatureKey(value: string): value is FeatureKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS_BY_KEY, value);
}

export function getAncestorFeatureKeys(key: FeatureKey): FeatureKey[] {
  const visited = new Set<FeatureKey>();
  const stack: FeatureKey[] = [...(FEATURE_FLAGS_BY_KEY[key].dependsOn as readonly FeatureKey[])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const parent of FEATURE_FLAGS_BY_KEY[current].dependsOn as readonly FeatureKey[]) {
      if (!visited.has(parent)) stack.push(parent);
    }
  }
  return [...visited];
}

export function getDependentFeatureKeys(rootKey: FeatureKey): FeatureKey[] {
  const visited = new Set<FeatureKey>();
  const queue: FeatureKey[] = [rootKey];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const flag of FEATURE_FLAGS) {
      const deps = flag.dependsOn as readonly FeatureKey[];
      if (deps.includes(current) && !visited.has(flag.key)) {
        visited.add(flag.key);
        queue.push(flag.key);
      }
    }
  }
  return [...visited];
}

export function resolveEffectiveFeatureFlags(
  overrides: Partial<Record<FeatureKey, boolean>> = {}
): Record<FeatureKey, boolean> {
  const raw = {} as Record<FeatureKey, boolean>;
  for (const flag of FEATURE_FLAGS) {
    const override = overrides[flag.key];
    raw[flag.key] = typeof override === 'boolean' ? override : flag.defaultEnabled;
  }
  const resolved = {} as Record<FeatureKey, boolean>;
  const resolveOne = (key: FeatureKey): boolean => {
    const cached = resolved[key];
    if (cached !== undefined) return cached;
    if (!raw[key]) {
      resolved[key] = false;
      return false;
    }
    for (const parent of FEATURE_FLAGS_BY_KEY[key].dependsOn as readonly FeatureKey[]) {
      if (!resolveOne(parent)) {
        resolved[key] = false;
        return false;
      }
    }
    resolved[key] = true;
    return true;
  };
  for (const flag of FEATURE_FLAGS) {
    resolveOne(flag.key);
  }
  return resolved;
}

export function matchesFeatureApiPattern(pathname: string, pattern: string): boolean {
  const clean = (value: string): string[] =>
    value.split(/[?#]/)[0].split('/').filter(Boolean);
  const pathSegs = clean(pathname);
  const patternSegs = clean(pattern);
  if (patternSegs.length === 0 || pathSegs.length < patternSegs.length) {
    return false;
  }
  for (let i = 0; i < patternSegs.length; i += 1) {
    const patternSeg = patternSegs[i];
    const pathSeg = pathSegs[i];
    if (!pathSeg) return false;
    if (/^\[[^\]]+\]$/.test(patternSeg)) continue;
    if (patternSeg !== pathSeg) return false;
  }
  return true;
}

export function getRequiredFeaturesForApiPath(pathname: string): FeatureKey[] {
  const required: FeatureKey[] = [];
  for (const flag of FEATURE_FLAGS) {
    const matched = (flag.apiPrefixes as readonly string[]).some((pattern) =>
      matchesFeatureApiPattern(pathname, pattern)
    );
    if (matched && !required.includes(flag.key)) {
      required.push(flag.key);
    }
  }
  return required;
}
