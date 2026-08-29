// UI-FOUR-STATES & UI-ACCESSIBILITY support

export type UIState = 'loading' | 'empty' | 'error' | 'success';

export interface AccessibleComponent {
  ariaLabel: string;
  ariaDescribedBy?: string;
  role?: string;
  tabIndex?: number;
}
