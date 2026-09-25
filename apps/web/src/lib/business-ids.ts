/**
 * Business Identifiers Presentation Layer
 * ADR-002, INT-CORE-DECOUPLED: Database operates on UUID, UI presents readable business IDs.
 */

export type BusinessEntityType = 'organization' | 'resident' | 'room' | 'staff';

export const BUSINESS_PREFIXES: Record<BusinessEntityType, string> = {
  organization: 'PLC',
  resident: 'PEN',
  room: 'POK',
  staff: 'PRAC',
};

const PADDING_LENGTHS: Record<BusinessEntityType, number> = {
  organization: 3,
  resident: 4,
  room: 3,
  staff: 2,
};

export function formatBusinessId(
  type: BusinessEntityType,
  uuidOrId: string,
  sequenceNumber?: number
): string {
  const prefix = BUSINESS_PREFIXES[type];
  if (!prefix) {
    throw new Error(`Unsupported business entity type: ${type}`);
  }

  if (typeof sequenceNumber === 'number' && sequenceNumber > 0) {
    const pad = PADDING_LENGTHS[type];
    return `${prefix}-${String(sequenceNumber).padStart(pad, '0')}`;
  }

  // Deterministic code derived from UUID
  const clean = uuidOrId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const shortCode = clean.slice(0, 4).padEnd(4, '0');
  return `${prefix}-${shortCode}`;
}

export function isValidBusinessId(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^(PLC|PEN|POK|PRAC)-[A-Z0-9]{2,6}$/.test(code);
}

export function parseBusinessId(
  code: string
): { type: BusinessEntityType; code: string; prefix: string } | null {
  if (!isValidBusinessId(code)) return null;
  const [prefix, numOrCode] = code.split('-');

  let type: BusinessEntityType | null = null;
  for (const [t, p] of Object.entries(BUSINESS_PREFIXES)) {
    if (p === prefix) {
      type = t as BusinessEntityType;
      break;
    }
  }

  if (!type) return null;

  return {
    type,
    code: numOrCode,
    prefix,
  };
}
