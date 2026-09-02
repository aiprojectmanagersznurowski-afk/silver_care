import { PHYSIOLOGICAL_FIELDS } from '@silvercare/contracts/src/generated/presentation';

export function maskPhysiologicalData(content: any): any {
  if (!content || typeof content !== 'object') {
    return content;
  }

  const cleanedContent = { ...content };

  for (const field of PHYSIOLOGICAL_FIELDS) {
    if (field in cleanedContent) {
      delete cleanedContent[field];
    }
  }

  return cleanedContent;
}
