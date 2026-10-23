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
  "baseSize": "16px",
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
      "size": "20px",
      "weight": 600,
      "lineHeight": 1.4,
      "tracking": "0",
      "use": "Nagłówek karty. (text-xl)"
    },
    {
      "id": "body",
      "size": "16px",
      "weight": 400,
      "lineHeight": 1.5,
      "tracking": "0",
      "use": "Treść interfejsu i raportu, opisy. Domyślny rozmiar bazowy. (text-base)"
    },
    {
      "id": "callout",
      "size": "14px",
      "weight": 500,
      "lineHeight": 1.43,
      "tracking": "0",
      "use": "Etykiety pomocnicze, wartości metryk w tabelach. (text-sm)"
    },
    {
      "id": "caption",
      "size": "14px",
      "weight": 400,
      "lineHeight": 1.43,
      "tracking": "0.01em",
      "use": "Znaczniki czasu, etykieta AI. Minimalny dopuszczalny tekst pomocniczy. (text-sm)"
    }
  ],
  "rules": [
    "Waga 600 zamiast 700 — cięższy krój psuje spokojny ton.",
    "Nigdy poniżej 14px (text-sm). Klasy text-xs, text-[11px], text-[10px] są surowo zabronione.",
    "Długość wiersza w raporcie maksymalnie 68 znaków.",
    "Bez wersalików w treści — pogarszają czytelność przy zmęczonym wzroku."
  ]
} as const;

export const COLORS = {
  "light": {
    "bg": {
      "value": "#FFFFFF",
      "desc": "Tło aplikacji. Czysta biel jak w szablonie shadcn-admin (ADR-019)."
    },
    "surface": {
      "value": "#FFFFFF",
      "desc": "Karty i panele; granicę daje linia i cień shadow-xs."
    },
    "surface-sunken": {
      "value": "#F5F5F5",
      "desc": "Tło wyciszone (muted/secondary): stan pusty, najechanie, wyróżnienie bez ramki."
    },
    "border": {
      "value": "#E5E5E5",
      "desc": "Linie rozdzielające (neutral-200 szablonu)."
    },
    "text": {
      "value": "#171717",
      "desc": "Tekst główny. Kontrast 17.9:1 na tle."
    },
    "text-secondary": {
      "value": "#666666",
      "desc": "Tekst drugorzędny. Kontrast 5.7:1 na bieli i 5.3:1 na tle wyciszonym — AA także na szarym tle."
    },
    "text-tertiary": {
      "value": "#6B6B6B",
      "desc": "Znaczniki czasu. Kontrast 5.3:1 — AA."
    },
    "accent": {
      "value": "#2F6F5E",
      "desc": "Kojąca zieleń. Akcje i odnośniki. Kontrast 5.6:1."
    },
    "accent-soft": {
      "value": "#F5F5F5",
      "desc": "Tło najechania i wyróżnienia — neutralne; kolor marki tylko tam, gdzie konieczny (ADR-019)."
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
      "value": "#E5E5E5",
      "desc": "Obramowanie pól formularza."
    },
    "destructive": {
      "value": "#DC2626",
      "desc": "Wyłącznie błąd techniczny (walidacja, awaria sieci/serwera). Nigdy potwierdzenie akcji nieodwracalnej i nigdy ocena stanu pensjonariusza. Kontrast 4.8:1."
    },
    "destructive-foreground": {
      "value": "#FFFFFF",
      "desc": "Tekst na tle błędu."
    },
    "sidebar": {
      "value": "#FAFAFA",
      "desc": "Tło paska bocznego (neutral-50 szablonu)."
    },
    "sidebar-accent": {
      "value": "#F5F5F5",
      "desc": "Aktywna i najechana pozycja menu — neutralna, znacznik aktywności w kolorze marki."
    },
    "chart-1": {
      "value": "#2F6F5E",
      "desc": "Seria 1."
    },
    "chart-2": {
      "value": "#4F8F7C",
      "desc": "Seria 2. Kontrast 3,6:1."
    },
    "chart-3": {
      "value": "#878787",
      "desc": "Seria 3 — neutralna szarość. Kontrast 3,6:1."
    },
    "chart-4": {
      "value": "#1F4A3F",
      "desc": "Seria 4 — głęboka zieleń. Kontrast 9,5:1."
    },
    "chart-5": {
      "value": "#525252",
      "desc": "Seria 5 — neutralna, ciemna. Kontrast 7,8:1."
    }
  },
  "dark": {
    "bg": {
      "value": "#171717"
    },
    "surface": {
      "value": "#262626"
    },
    "surface-sunken": {
      "value": "#303030"
    },
    "border": {
      "value": "#333333"
    },
    "text": {
      "value": "#FAFAFA"
    },
    "text-secondary": {
      "value": "#A1A1A1"
    },
    "text-tertiary": {
      "value": "#A1A1A1"
    },
    "accent": {
      "value": "#7FBCA8"
    },
    "accent-soft": {
      "value": "#303030"
    },
    "focus": {
      "value": "#7FBCA8"
    },
    "accent-foreground": {
      "value": "#171717"
    },
    "input": {
      "value": "#3A3A3A"
    },
    "destructive": {
      "value": "#F87171"
    },
    "destructive-foreground": {
      "value": "#171717"
    },
    "sidebar": {
      "value": "#262626"
    },
    "sidebar-accent": {
      "value": "#303030"
    },
    "chart-1": {
      "value": "#7FBCA8"
    },
    "chart-2": {
      "value": "#5FA08C"
    },
    "chart-3": {
      "value": "#8F8F8F"
    },
    "chart-4": {
      "value": "#3F7A69"
    },
    "chart-5": {
      "value": "#B5B5B5"
    }
  },
  "rules": [
    "Zakaz czerwieni i zieleni jako oceny stanu pensjonariusza (ADR-005).",
    "Czerwień wyłącznie dla błędów technicznych (ADR-017).",
    "Kolor marki (accent) wyłącznie tam, gdzie konieczny: akcja główna, element aktywny, odnośnik, fokus. Tła, powierzchnie i najechania są neutralne (ADR-019).",
    "Kolor nigdy nie jest jedynym nośnikiem informacji — zawsze towarzyszy mu tekst.",
    "Kolory chart-* wyłącznie dla statystyk placówki w panelu administratora — nigdy dla metryk pensjonariusza (ADR-005).",
    "Każda seria chart-* ma kontrast co najmniej 3:1 na tle bg i surface w obu motywach (WCAG 1.4.11). Serie rozróżnia też podpis lub legenda, nie tylko kolor."
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
  "card": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  "modal": "0 8px 32px rgb(0 0 0 / 0.12)",
  "rules": [
    "Karty i przyciski główne z cieniem shadow-xs (jak w szablonie, ADR-019).",
    "Większy cień zarezerwowany dla warstw nad treścią (dialog, menu, popover)."
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
  "touchTargetMinimum": "38px",
  "focusVisible": "Zawsze widoczny pierścień 2px w kolorze akcentu z odsunięciem 2px.",
  "textZoom": "Układ nie psuje się przy powiększeniu do 200%.",
  "rules": [
    "Minimalny cel dotykowy dla przycisków i interakcji: 38x38px (min-h-touch min-w-touch); ADR-018 odwraca część ADR-016 — kompromis między normą bezpieczeństwa (44px) a skalą szablonu (32px).",
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

