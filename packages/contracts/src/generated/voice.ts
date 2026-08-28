// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const TRANSCRIPT_STREAMS = [
  {
    "id": "MEDICAL",
    "order": 1,
    "destination": "daily_logs.raw_data",
    "reachesLLM": false,
    "audience": [
      "nurse",
      "org_admin"
    ],
    "desc": "Leki, diagnozy, wyniki badań, parametry życiowe zestawiane w celu oceny kondycji.",
    "rule": "Usuwane z transkryptu PRZED wysłaniem do LLM. Zapisywane wyłącznie w brudnopisie personelu."
  },
  {
    "id": "DISCOMFORT",
    "order": 2,
    "destination": "daily_logs.raw_data + daily_reports.draft",
    "reachesLLM": true,
    "audience": [
      "nurse",
      "org_admin"
    ],
    "desc": "Zdarzenia naruszające godność: wymioty, biegunka, nietrzymanie.",
    "rule": "Oryginał zostaje w brudnopisie. Do raportu trafia wyłącznie ogólny opis dyskomfortu."
  },
  {
    "id": "BEHAVIORAL",
    "order": 3,
    "destination": "daily_reports.draft",
    "reachesLLM": true,
    "audience": [
      "nurse",
      "org_admin",
      "legal_guardian",
      "family"
    ],
    "desc": "Zachowanie, nastrój, apetyt, udział w zajęciach.",
    "rule": "Podstawa raportu dla bliskich."
  }
] as const;

export const MEDICAL_CATEGORIES = [
  {
    "id": "medication",
    "desc": "Nazwy leków, dawki, pory podania, plany terapeutyczne."
  },
  {
    "id": "diagnosis",
    "desc": "Rozpoznania, historie chorób, jednostki chorobowe."
  },
  {
    "id": "test_result",
    "desc": "Wyniki badań laboratoryjnych i obrazowych."
  },
  {
    "id": "vital_sign",
    "desc": "Ciśnienie, poziom cukru, EKG, saturacja — parametry oceniające kondycję organizmu."
  },
  {
    "id": "clinical_advice",
    "desc": "Zalecenia lekarskie, zmiany terapii."
  }
] as const;

export const PIPELINE_STAGES = [
  {
    "id": "CAPTURE",
    "actor": "nurse",
    "input": "audio + resident_id (UUID)",
    "output": "voice_draft_notes",
    "desc": "Nagranie z twardym identyfikatorem z frontendu."
  },
  {
    "id": "TRANSCRIBE",
    "actor": "system",
    "input": "audio",
    "output": "transkrypt tekstowy",
    "desc": "Transkrypcja bez kontekstu tożsamości."
  },
  {
    "id": "CLASSIFY",
    "actor": "system",
    "input": "transkrypt",
    "output": "trzy strumienie",
    "desc": "Rozdział na MEDICAL / DISCOMFORT / BEHAVIORAL przed wejściem do LLM."
  },
  {
    "id": "REDACT",
    "actor": "system",
    "input": "strumień MEDICAL",
    "output": "transkrypt bez danych medycznych",
    "desc": "Usunięcie fragmentów medycznych. Nieodwracalne dla ścieżki LLM."
  },
  {
    "id": "GENERATE",
    "actor": "llm",
    "input": "transkrypt zredagowany, anonimowy",
    "output": "draft raportu",
    "desc": "Model nie zna tożsamości i nie widzi danych medycznych."
  },
  {
    "id": "REJOIN",
    "actor": "edge_function",
    "input": "draft + resident_id",
    "output": "daily_reports (draft)",
    "desc": "Złączenie z tożsamością w pamięci, przed zapisem."
  },
  {
    "id": "APPROVE",
    "actor": "nurse",
    "input": "draft",
    "output": "daily_reports (published)",
    "desc": "Publikacja wymaga człowieka. Dopiero wtedy RLS odsłania raport bliskim."
  }
] as const;

export const VOICE_RETENTION = {
  "table": "voice_draft_notes",
  "ttlDays": 30,
  "enforcedBy": "cron bazodanowy",
  "status": "STABLE"
} as const;

export const AI_PROVENANCE_FIELDS = [
  "ai_model",
  "ai_prompt_version",
  "ai_generated_at",
  "approved_by",
  "approved_at"
] as const;

export const AI_FEEDBACK_CATEGORIES = [
  "medical_error",
  "hallucination",
  "privacy_violation",
  "tone_violation",
  "mdr_violation"
] as const;

