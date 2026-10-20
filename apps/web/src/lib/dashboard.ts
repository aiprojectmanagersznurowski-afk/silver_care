import { PHYSIOLOGICAL_FIELDS } from '@silvercare/contracts/src/generated/presentation';

export function maskPhysiologicalData<T>(content: T): T {
  if (!content || typeof content !== 'object') {
    return content;
  }

  const cleanedContent = { ...(content as Record<string, unknown>) };

  for (const field of PHYSIOLOGICAL_FIELDS) {
    if (field in cleanedContent) {
      delete cleanedContent[field];
    }
  }

  return cleanedContent as T;
}
