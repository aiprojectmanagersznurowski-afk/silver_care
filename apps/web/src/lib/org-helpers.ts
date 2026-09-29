/**
 * Facility and organization management helpers
 */

export type OrgViewMode = 'cards' | 'table';

export function isValidViewMode(mode: unknown): mode is OrgViewMode {
  return mode === 'cards' || mode === 'table';
}

export function formatAddressSuggestion(
  suggestion: string | { description?: string; mainText?: string; secondaryText?: string }
): string {
  if (typeof suggestion === 'string') {
    return suggestion.trim();
  }
  if (suggestion.description) {
    return suggestion.description.trim();
  }
  const parts = [suggestion.mainText, suggestion.secondaryText].filter(Boolean);
  return parts.join(', ').trim();
}

export interface OrganizationUpdateInput {
  orgName?: string;
  residentLimit?: string | number;
  address?: string | null;
}

export interface OrganizationUpdateValidationResult {
  valid: boolean;
  data?: {
    orgName: string;
    residentLimit: number;
    address: string | null;
  };
  error?: string;
}

export function validateOrganizationUpdate(input: OrganizationUpdateInput): OrganizationUpdateValidationResult {
  const trimmedName = input.orgName?.trim();
  if (!trimmedName) {
    return {
      valid: false,
      error: 'Nazwa placówki jest wymagana.'
    };
  }

  const limitNum = Number(input.residentLimit);
  if (isNaN(limitNum) || limitNum <= 0 || !Number.isInteger(limitNum)) {
    return {
      valid: false,
      error: 'Limit pensjonariuszy musi być dodatnią liczbą całkowitą.'
    };
  }

  const trimmedAddress = input.address?.trim() || null;

  return {
    valid: true,
    data: {
      orgName: trimmedName,
      residentLimit: limitNum,
      address: trimmedAddress
    }
  };
}
