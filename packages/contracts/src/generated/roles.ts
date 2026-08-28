// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const ROLES = [
  {
    "id": "super_admin",
    "scope": "GLOBAL",
    "desc": "Operator platformy Silver Care. Zarządza placówkami, nie czyta treści opieki."
  },
  {
    "id": "org_admin",
    "scope": "ORGANIZATION",
    "desc": "Administrator placówki. Zarządza pensjonariuszami, personelem i powiązaniami rodzin."
  },
  {
    "id": "nurse",
    "scope": "ORGANIZATION",
    "desc": "Personel opiekuńczy. Tworzy notatki, zatwierdza raporty."
  },
  {
    "id": "legal_guardian",
    "scope": "RESIDENT",
    "desc": "Opiekun prawny. JEDYNA rola po stronie bliskich, która może wyrazić zgodę na przetwarzanie danych o zdrowiu."
  },
  {
    "id": "family",
    "scope": "RESIDENT",
    "desc": "Członek rodziny. Odbiorca raportów. NIE może wyrażać ani cofać zgód."
  }
] as const;

export const STAFF_ROLES = [
  "super_admin",
  "org_admin",
  "nurse"
] as const;

export const RELATIVE_ROLES = [
  "legal_guardian",
  "family"
] as const;

export const MFA_REQUIRED_ROLES = [
  "super_admin",
  "org_admin",
  "nurse"
] as const;

export const CONSENT_GRANTORS = [
  "resident_self",
  "legal_guardian"
] as const;

export const CONSENT_PURPOSES = [
  {
    "id": "wellness_data_ingest",
    "desc": "Pobieranie danych behawioralnych z opaski do systemu.",
    "article9": true
  },
  {
    "id": "family_report_access",
    "desc": "Udostępnianie dziennego raportu wskazanym bliskim.",
    "article9": true
  },
  {
    "id": "wellness_family_view",
    "desc": "Prezentacja metryk behawioralnych bliskim (wariant B).",
    "article9": true
  }
] as const;

export const RESOURCES = [
  "organizations",
  "profiles",
  "residents",
  "resident_relative_links",
  "consent_ledger",
  "daily_logs",
  "daily_reports",
  "daily_agenda",
  "voice_draft_notes",
  "family_messages",
  "invitations",
  "external_wearable_links",
  "wellness_daily",
  "audit_logs",
  "security_access_logs",
  "rooms",
  "beds",
  "bed_assignments"
] as const;

export const MATRIX = [
  {
    "resource": "organizations",
    "read": [
      "super_admin",
      "org_admin:own"
    ],
    "create": [
      "super_admin"
    ],
    "update": [
      "super_admin"
    ],
    "delete": []
  },
  {
    "resource": "profiles",
    "read": [
      "super_admin",
      "org_admin:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin"
    ],
    "delete": []
  },
  {
    "resource": "residents",
    "read": [
      "org_admin:own",
      "nurse:own",
      "legal_guardian:own",
      "family:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin"
    ],
    "delete": []
  },
  {
    "resource": "resident_relative_links",
    "read": [
      "org_admin:own",
      "legal_guardian:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin"
    ],
    "delete": []
  },
  {
    "resource": "consent_ledger",
    "read": [
      "org_admin:own",
      "legal_guardian:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [],
    "delete": []
  },
  {
    "resource": "daily_logs",
    "read": [
      "nurse:own",
      "org_admin:own"
    ],
    "create": [
      "nurse"
    ],
    "update": [
      "nurse:own"
    ],
    "delete": []
  },
  {
    "resource": "daily_reports",
    "read": [
      "nurse:own",
      "org_admin:own",
      "legal_guardian:own",
      "family:own"
    ],
    "create": [
      "nurse"
    ],
    "update": [
      "nurse:own",
      "org_admin:own"
    ],
    "delete": []
  },
  {
    "resource": "daily_agenda",
    "read": [
      "nurse:own",
      "org_admin:own",
      "legal_guardian:own",
      "family:own"
    ],
    "create": [
      "nurse"
    ],
    "update": [
      "nurse:own"
    ],
    "delete": [
      "org_admin:own"
    ]
  },
  {
    "resource": "voice_draft_notes",
    "read": [
      "nurse:own"
    ],
    "create": [
      "nurse"
    ],
    "update": [],
    "delete": [
      "nurse:own"
    ]
  },
  {
    "resource": "family_messages",
    "read": [
      "nurse:own",
      "org_admin:own",
      "legal_guardian:own",
      "family:own"
    ],
    "create": [
      "legal_guardian:own",
      "family:own"
    ],
    "update": [],
    "delete": []
  },
  {
    "resource": "invitations",
    "read": [
      "org_admin:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin:own"
    ],
    "delete": []
  },
  {
    "resource": "external_wearable_links",
    "read": [
      "org_admin:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin:own"
    ],
    "delete": []
  },
  {
    "resource": "wellness_daily",
    "read": [
      "org_admin:own",
      "nurse:own",
      "legal_guardian:own",
      "family:own"
    ],
    "create": [],
    "update": [],
    "delete": []
  },
  {
    "resource": "audit_logs",
    "read": [
      "super_admin",
      "org_admin:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [],
    "delete": []
  },
  {
    "resource": "security_access_logs",
    "read": [
      "super_admin"
    ],
    "create": [],
    "update": [],
    "delete": []
  },
  {
    "resource": "rooms",
    "read": [
      "org_admin:own",
      "nurse:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin:own"
    ],
    "delete": []
  },
  {
    "resource": "beds",
    "read": [
      "org_admin:own",
      "nurse:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin:own"
    ],
    "delete": []
  },
  {
    "resource": "bed_assignments",
    "read": [
      "org_admin:own",
      "nurse:own"
    ],
    "create": [
      "org_admin"
    ],
    "update": [
      "org_admin:own"
    ],
    "delete": []
  }
] as const;

export const AUDIT_REQUIREMENTS = {
  "appendOnly": true,
  "mustLog": [
    "delete",
    "anonymize",
    "consent_grant",
    "consent_revoke",
    "role_change",
    "impersonation",
    "report_publish",
    "access_revoke"
  ],
  "legalBases": [
    "RODO_ERASURE_REQUEST",
    "CONSENT_WITHDRAWN",
    "OPERATIONAL_ERROR",
    "RETENTION_POLICY",
    "COURT_ORDER",
    "OTHER"
  ],
  "requiresJustification": true,
  "retentionDays": 1825,
  "status": "STABLE"
} as const;

export type Role = typeof ROLES[number]['id'];
export type Resource = typeof RESOURCES[number];
