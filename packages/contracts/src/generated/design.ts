// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const TYPOGRAPHY = {
  "fontStack": "-apple-system, BlinkMacSystemFont, \"Inter\", \"Segoe UI\", system-ui, sans-serif",
  "webfont": {
    "family": "Inter",
    "weights": [
      400,
      500,
      600
    ],
    "subset": "latin-ext",
    "note": "latin-ext jest wymagany — polskie znaki diakrytyczne."
  },
  "baseSize": "14px",
  "scale": [
    {
      "id": "display",
      "size": "30px",
      "weight": 600,
      "lineHeight": 1.2,
      "tracking": "-0.02em",
      "use": "Nagłówek raportu dnia. Jedyne miejsce na ten rozmiar. (text-3xl)"
    },
    {
      "id": "title",
      "size": "24px",
      "weight": 600,
      "lineHeight": 1.33,
      "tracking": "-0.01em",
      "use": "Nagłówek strony i sekcji, imię pensjonariusza. (text-2xl)"
    },
    {
      "id": "heading",
      "size": "16px",
      "weight": 600,
      "lineHeight": 1.5,
      "tracking": "0",
      "use": "Nagłówek karty. (text-base)"
    },
    {
      "id": "body",
      "size": "14px",
      "weight": 400,
      "lineHeight": 1.43,
      "tracking": "0",
      "use": "Treść interfejsu i raportu, opisy. Domyślny rozmiar. (text-sm)"
    },
    {
      "id": "callout",
      "size": "13px",
      "weight": 400,
      "lineHeight": 1.4,
      "tracking": "0",
      "use": "Etykiety pomocnicze, wartości metryk w tabelach."
    },
    {
      "id": "caption",
      "size": "12px",
      "weight": 400,
      "lineHeight": 1.33,
      "tracking": "0.01em",
      "use": "Znaczniki czasu, etykieta AI. Nigdy dla treści istotnej. (text-xs)"
    }
  ],
  "rules": [
    "Waga 600 zamiast 700 — cięższy krój psuje spokojny ton.",
    "Nigdy poniżej 12px. Etykieta wymagana przez EU AI Act musi być czytelna, nie ukryta.",
    "Długość wiersza w raporcie maksymalnie 68 znaków.",
    "Bez wersalików w treści — pogarszają czytelność przy zmęczonym wzroku."
  ]
} as const;

export const COLORS = {
  "light": {
    "bg": {
      "value": "#FBFAF8",
      "desc": "Tło aplikacji. Ciepła biel, nie czysta — mniej męczy oczy."
    },
    "surface": {
      "value": "#FFFFFF",
      "desc": "Karty i panele."
    },
    "surface-sunken": {
      "value": "#F4F2EE",
      "desc": "Tło stanu pustego, wyróżnienia bez ramki."
    },
    "border": {
      "value": "#E8E4DD",
      "desc": "Linie rozdzielające. Jedyny sposób na granicę — bez cieni."
    },
    "text": {
      "value": "#1C1B19",
      "desc": "Tekst główny. Kontrast 15.8:1 na tle."
    },
    "text-secondary": {
      "value": "#57534E",
      "desc": "Tekst drugorzędny. Kontrast 7.4:1 — powyżej AA, celowo ciemniejszy niż zwykle."
    },
    "text-tertiary": {
      "value": "#78716C",
      "desc": "Znaczniki czasu. Kontrast 4.7:1 — nadal AA."
    },
    "accent": {
      "value": "#2F6F5E",
      "desc": "Kojąca zieleń. Akcje i odnośniki. Kontrast 5.6:1."
    },
    "accent-soft": {
      "value": "#E8F0ED",
      "desc": "Tło akcentu, delikatne wyróżnienie."
    },
    "focus": {
      "value": "#2F6F5E",
      "desc": "Pierścień fokusu, grubość 2px, odsunięcie 2px."
    },
    "accent-foreground": {
      "value": "#FFFFFF",
      "desc": "Tekst na tle akcentu (przycisk główny). Kontrast 5.6:1."
    },
    "input": {
      "value": "#E8E4DD",
      "desc": "Obramowanie pól formularza."
    },
    "destructive": {
      "value": "#DC2626",
      "desc": "Wyłącznie błąd techniczny i akcja destrukcyjna. Kontrast 4.8:1. Nigdy ocena stanu pensjonariusza."
    },
    "destructive-foreground": {
      "value": "#FFFFFF",
      "desc": "Tekst na tle błędu."
    },
    "sidebar": {
      "value": "#FFFFFF",
      "desc": "Tło paska bocznego."
    },
    "sidebar-accent": {
      "value": "#E8F0ED",
      "desc": "Aktywna i najechana pozycja menu."
    },
    "portal-primary": {
      "value": "#1E3A8A",
      "desc": "Akcent portalu bliskich (klasa sage). Kontrast 10.4:1."
    },
    "portal-primary-deep": {
      "value": "#172554",
      "desc": "Stan wciśnięty akcentu portalu."
    },
    "portal-primary-soft": {
      "value": "#EFF6FF",
      "desc": "Tło wyróżnienia w portalu."
    },
    "portal-surface": {
      "value": "#FFFFFF",
      "desc": "Tło kart portalu (klasa cream)."
    },
    "portal-surface-deep": {
      "value": "#F8FAFC",
      "desc": "Tło sekcji portalu."
    },
    "portal-ink": {
      "value": "#0F172A",
      "desc": "Tekst główny portalu (klasa slate). Kontrast 17.9:1."
    },
    "portal-ink-soft": {
      "value": "#64748B",
      "desc": "Tekst drugorzędny portalu. Kontrast 4.8:1."
    },
    "chart-1": {
      "value": "#2F6F5E",
      "desc": "Seria 1."
    },
    "chart-2": {
      "value": "#4F8F7C",
      "desc": "Seria 2."
    },
    "chart-3": {
      "value": "#7FBCA8",
      "desc": "Seria 3."
    },
    "chart-4": {
      "value": "#A9D2C4",
      "desc": "Seria 4."
    },
    "chart-5": {
      "value": "#57534E",
      "desc": "Seria 5 — neutralna."
    }
  },
  "dark": {
    "bg": {
      "value": "#171614"
    },
    "surface": {
      "value": "#211F1D"
    },
    "surface-sunken": {
      "value": "#2A2724"
    },
    "border": {
      "value": "#38342F"
    },
    "text": {
      "value": "#F5F3F0"
    },
    "text-secondary": {
      "value": "#B8B2AA"
    },
    "text-tertiary": {
      "value": "#918B83"
    },
    "accent": {
      "value": "#7FBCA8"
    },
    "accent-soft": {
      "value": "#1E3A32"
    },
    "focus": {
      "value": "#7FBCA8"
    },
    "accent-foreground": {
      "value": "#171614"
    },
    "input": {
      "value": "#38342F"
    },
    "destructive": {
      "value": "#F87171"
    },
    "destructive-foreground": {
      "value": "#171614"
    },
    "sidebar": {
      "value": "#211F1D"
    },
    "sidebar-accent": {
      "value": "#1E3A32"
    },
    "portal-primary": {
      "value": "#60A5FA"
    },
    "portal-primary-deep": {
      "value": "#93C5FD"
    },
    "portal-primary-soft": {
      "value": "#1E3A8A"
    },
    "portal-surface": {
      "value": "#211F1D"
    },
    "portal-surface-deep": {
      "value": "#171614"
    },
    "portal-ink": {
      "value": "#F1F5F9"
    },
    "portal-ink-soft": {
      "value": "#CBD5E1"
    },
    "chart-1": {
      "value": "#7FBCA8"
    },
    "chart-2": {
      "value": "#5FA08C"
    },
    "chart-3": {
      "value": "#4F8F7C"
    },
    "chart-4": {
      "value": "#2F6F5E"
    },
    "chart-5": {
      "value": "#B8B2AA"
    }
  },
  "rules": [
    "Zakaz czerwieni i zieleni jako oceny stanu pensjonariusza (ADR-005).",
    "Czerwień wyłącznie dla błędów technicznych i akcji destrukcyjnych w panelu personelu.",
    "Kolor nigdy nie jest jedynym nośnikiem informacji — zawsze towarzyszy mu tekst.",
    "Kolory chart-* wyłącznie dla statystyk placówki w panelu administratora — nigdy dla metryk pensjonariusza (ADR-005)."
  ]
} as const;

export const SPACING = {
  "unit": 4,
  "scale": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px",
    "2xl": "48px",
    "3xl": "64px"
  },
  "rules": [
    "Odstęp między sekcjami minimum 32px. Ciasny układ czyta się jak formularz urzędowy.",
    "Wewnętrzny margines karty 16px, karta mała 12px (szablon shadcn, ADR-014).",
    "Przestrzeń jest podstawowym narzędziem podziału — przed sięgnięciem po ramkę zwiększ odstęp."
  ]
} as const;

export const RADIUS = {
  "sm": "6px",
  "md": "8px",
  "lg": "10px",
  "xl": "14px",
  "full": "999px",
  "rules": [
    "Bazowe zaokrąglenie 10px (--radius szablonu). Karty 14px, pola i przyciski 8px (ADR-014)."
  ]
} as const;

export const ELEVATION = {
  "none": "none",
  "card": "0 1px 2px rgba(28, 27, 25, 0.04)",
  "modal": "0 8px 32px rgba(28, 27, 25, 0.12)",
  "rules": [
    "Karty domyślnie bez cienia — wystarczy tło i linia.",
    "Cień zarezerwowany dla warstw nad treścią."
  ]
} as const;

export const MOTION = {
  "durations": {
    "instant": "100ms",
    "fast": "180ms",
    "normal": "260ms"
  },
  "easing": "cubic-bezier(0.32, 0.72, 0, 1)",
  "rules": [
    "Animacja wyłącznie dla zmiany stanu, nigdy dekoracyjnie.",
    "Respektuj prefers-reduced-motion — dla części odbiorców ruch jest źródłem dezorientacji.",
    "Bez animacji wejścia treści raportu. Tekst ma być od razu."
  ]
} as const;

export const ACCESSIBILITY = {
  "contrastMinimum": 4.5,
  "touchTargetMinimum": "32px",
  "focusVisible": "Zawsze widoczny pierścień 2px w kolorze akcentu z odsunięciem 2px.",
  "textZoom": "Układ nie psuje się przy powiększeniu do 200%.",
  "rules": [
    "Każda ikona niosąca znaczenie ma etykietę tekstową.",
    "Formularz opisany etykietą, nigdy samym placeholderem.",
    "Nawigacja klawiaturą obejmuje wszystkie akcje."
  ]
} as const;

export const LAYOUT_PRINCIPLES = [
  {
    "id": "one-thing",
    "rule": "Jeden ekran, jedno zadanie. Portal bliskich otwiera się na raporcie dnia i niczym więcej."
  },
  {
    "id": "content-first",
    "rule": "Treść przed nawigacją. Nagłówek jest cienki, bez logotypu zajmującego pół ekranu."
  },
  {
    "id": "no-chrome",
    "rule": "Bez ozdobnych obramowań, gradientów i ikon dekoracyjnych."
  },
  {
    "id": "max-width",
    "rule": "Kolumna treści maksymalnie 680px. Szerszy raport czyta się gorzej."
  },
  {
    "id": "mobile-first",
    "rule": "Portal bliskich projektowany na telefon; wersja szeroka to ten sam układ z większym marginesem."
  },
  {
    "id": "quiet-metrics",
    "rule": "Metryki prezentowane jako fakty, bez wykresów sugerujących trend i ocenę (ADR-005)."
  }
] as const;

