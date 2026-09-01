import { describe, it, expect } from 'vitest';
import { maskPhysiologicalData } from '../../apps/web/src/lib/dashboard';

describe('Dashboard Logic (FAM-DASHBOARD & MDR-NO-PHYSIO-TO-FAMILY)', () => {
  it('strips physiological fields from report content @REQ: MDR-NO-PHYSIO-TO-FAMILY', () => {
    const rawContent = {
      text: 'Dzisiaj był udany spacer.',
      steps_total: 4500, // behavioral - should stay
      heart_rate_bpm: 75, // physiological - should be removed
      hrv_ms: 45, // physiological - should be removed
      other_field: 'ok'
    };

    const cleanedContent = maskPhysiologicalData(rawContent);

    expect(cleanedContent.text).toBe('Dzisiaj był udany spacer.');
    expect(cleanedContent.steps_total).toBe(4500);
    expect(cleanedContent.other_field).toBe('ok');
    
    expect(cleanedContent).not.toHaveProperty('heart_rate_bpm');
    expect(cleanedContent).not.toHaveProperty('hrv_ms');
  });

  it('handles empty or null content gracefully', () => {
    expect(maskPhysiologicalData(null)).toBeNull();
    expect(maskPhysiologicalData(undefined)).toBeUndefined();
    expect(maskPhysiologicalData({})).toEqual({});
  });
});
