// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const FACILITY_HIERARCHY = [
  "organization",
  "floor",
  "room",
  "bed"
] as const;

export const ROOM_SHAPE = {
  "table": "rooms",
  "fields": [
    {
      "name": "id",
      "type": "uuid",
      "desc": "Klucz główny."
    },
    {
      "name": "organization_id",
      "type": "uuid",
      "desc": "Izolacja placówki — jak wszystko inne w systemie."
    },
    {
      "name": "number",
      "type": "text",
      "desc": "Numer albo nazwa pokoju, np. „204\" albo „Słoneczny\". Unikalny w obrębie placówki."
    },
    {
      "name": "floor",
      "type": "text",
      "desc": "Piętro. Wartość opisowa, nie liczba — dopuszcza „Parter\"."
    },
    {
      "name": "sector",
      "type": "text",
      "desc": "Sektor/skrzydło placówki. Nullable — nie każda placówka ma podział na sektory."
    },
    {
      "name": "bed_count",
      "type": "int",
      "desc": "Pole pochodne: liczba łóżek przypisanych do pokoju. Nie edytowane ręcznie."
    },
    {
      "name": "is_active",
      "type": "boolean",
      "desc": "Pokój wyłączony z użytku (remont) nie znika z historii, ale nie przyjmuje nowych przypisań."
    }
  ],
  "uniqueness": "Para (organization_id, number) unikalna — dwa pokoje o tym samym numerze w jednej placówce to błąd wprowadzania danych, nie różne pokoje."
} as const;

export const BED_SHAPE = {
  "table": "beds",
  "fields": [
    {
      "name": "id",
      "type": "uuid",
      "desc": "Klucz główny."
    },
    {
      "name": "room_id",
      "type": "uuid",
      "desc": "FK do rooms."
    },
    {
      "name": "label",
      "type": "text",
      "desc": "Etykieta w obrębie pokoju: „1\", „A\", „przy oknie\". Unikalna w obrębie pokoju, nie globalnie."
    },
    {
      "name": "is_active",
      "type": "boolean",
      "desc": "Łóżko wyłączone z użytku bez usuwania historii przypisań."
    }
  ],
  "uniqueness": "Para (room_id, label) unikalna."
} as const;

export const BED_ASSIGNMENT_SHAPE = {
  "table": "bed_assignments",
  "fields": [
    {
      "name": "id",
      "type": "uuid",
      "desc": "Klucz główny."
    },
    {
      "name": "bed_id",
      "type": "uuid",
      "desc": "FK do beds."
    },
    {
      "name": "resident_id",
      "type": "uuid",
      "desc": "FK do residents."
    },
    {
      "name": "assigned_at",
      "type": "timestamp",
      "desc": "Początek przypisania."
    },
    {
      "name": "unassigned_at",
      "type": "timestamp",
      "desc": "Nullable. NULL oznacza przypisanie wciąż aktywne."
    },
    {
      "name": "assigned_by",
      "type": "uuid",
      "desc": "Kto wykonał przypisanie — do audytu."
    },
    {
      "name": "reason",
      "type": "text",
      "desc": "Powód zmiany: przyjęcie, przeniesienie, wypis. Nullable dla pierwszego przypisania."
    }
  ],
  "invariant": "W danym momencie co najwyżej jedno przypisanie z unassigned_at = NULL na dane bed_id, i co najwyżej jedno na dane resident_id. Jedno łóżko, jeden aktywny pensjonariusz. Jeden pensjonariusz, jedno aktywne łóżko."
} as const;

export const OCCUPANCY_GUARDS = [
  {
    "id": "bed_single_occupant",
    "desc": "Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane, nie nadpisywane.",
    "onViolation": "REJECT"
  },
  {
    "id": "resident_single_bed",
    "desc": "Pensjonariusz z aktywnym przypisaniem nie może dostać drugiego bez zamknięcia pierwszego. Przeniesienie jest jedną operacją zamykającą stare i otwierającą nowe, nie dwiema osobnymi.",
    "onViolation": "REJECT"
  },
  {
    "id": "inactive_bed_no_assign",
    "desc": "Łóżko oznaczone jako nieaktywne nie przyjmuje nowych przypisań.",
    "onViolation": "REJECT"
  },
  {
    "id": "archived_resident_no_assign",
    "desc": "Zarchiwizowany pensjonariusz nie może dostać przypisania.",
    "onViolation": "REJECT"
  }
] as const;

export const OCCUPANCY_VIEW = {
  "name": "room_occupancy",
  "computedFrom": "bed_assignments WHERE unassigned_at IS NULL, zgrupowane po room_id",
  "fields": [
    "room_id",
    "bed_count",
    "occupied_count",
    "free_count"
  ],
  "desc": "Administrator widzi obłożenie bez ręcznego liczenia. Zawsze zgodne z bed_assignments, bo jest z niego wyliczane, nie kopiowane."
} as const;

