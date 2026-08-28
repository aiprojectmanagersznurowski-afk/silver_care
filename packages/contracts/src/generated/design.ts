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
  "baseSize": "17px",
  "scale": [
    {
      "id": "display",
      "size": "34px",
      "weight": 600,
      "lineHeight": 1.2,
      "tracking": "-0.02em",
      "use": "Nagłówek raportu dnia. Jedyne miejsce na ten rozmiar."
    },
    {
      "id": "title",
      "size": "24px",
      "weight": 600,
      "lineHeight": 1.3,
      "tracking": "-0.01em",
      "use": "Nagłówek sekcji, imię pensjonariusza."
    },
    {
      "id": "heading",
      "size": "20px",
      "weight": 600,
      "lineHeight": 1.35,
      "tracking": "0",
      "use": "Nagłówek karty."
    },
    {
      "id": "body",
      "size": "17px",
      "weight": 400,
      "lineHeight": 1.6,
      "tracking": "0",
      "use": "Treść raportu, opisy. Domyślny rozmiar."
    },
    {
      "id": "callout",
      "size": "15px",
      "weight": 400,
      "lineHeight": 1.5,
      "tracking": "0",
      "use": "Etykiety pól, wartości metryk."
    },
    {
      "id": "caption",
      "size": "13px",
      "weight": 400,
      "lineHeight": 1.4,
      "tracking": "0.01em",
      "use": "Znaczniki czasu, etykieta AI. Nigdy dla treści istotnej."
    }
  ],
  "rules": [
    "Waga 600 zamiast 700 — cięższy krój psuje spokojny ton.",
    "Nigdy poniżej 13px. Etykieta wymagana przez EU AI Act musi być czytelna, nie ukryta.",
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
    }
  },
  "rules": [
    "Zakaz czerwieni i zieleni jako oceny stanu pensjonariusza (ADR-005).",
    "Czerwień wyłącznie dla błędów technicznych i akcji destrukcyjnych w panelu personelu.",
    "Kolor nigdy nie jest jedynym nośnikiem informacji — zawsze towarzyszy mu tekst."
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
    "Wewnętrzny margines karty 24px, na wąskim ekranie 20px.",
    "Przestrzeń jest podstawowym narzędziem podziału — przed sięgnięciem po ramkę zwiększ odstęp."
  ]
} as const;

export const RADIUS = {
  "sm": "8px",
  "md": "12px",
  "lg": "16px",
  "full": "999px",
  "rules": [
    "Bez ostrych rogów. Zaokrąglenie 12px dla kart, 8px dla pól."
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
  "touchTargetMinimum": "48px",
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

