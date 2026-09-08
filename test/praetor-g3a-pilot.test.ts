import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAILURE_CATEGORIES } from '../experiments/praetor_verify_001/g3a/comparison.js';
import { verifyPrerequisites } from '../experiments/praetor_verify_001/g3a/freeze.js';

describe('G3A prospective orchestration gates', () => {
  it('verifies prerequisite, G2 and original G3 freezes without running their evaluations', () => {
    expect(verifyPrerequisites().g2).toBe('46f78b12efd7b7cb7d6c3a2bb0f118cab34adf3b00da201014126acb6fa42216');
  });
  it('retains every frozen G3 failure category without using it in the selection scorer', () => {
    const preregistration = readFileSync(new URL('../experiments/praetor_verify_001/g3/PREREGISTRATION.md', import.meta.url), 'utf8');
    expect(FAILURE_CATEGORIES).toHaveLength(13);
    for (const category of FAILURE_CATEGORIES) expect(preregistration).toContain(category);
    const scorer = readFileSync(new URL('../experiments/praetor_verify_001/g3a/selection.ts', import.meta.url), 'utf8');
    expect(scorer).not.toMatch(/from ['"].*(oracle|evaluator|runtime|comparison|pilot)/);
  });
  it('keeps toy-objective code free of decision and oracle imports', () => {
    const source = readFileSync(new URL('../experiments/praetor_verify_001/g3a/search.ts', import.meta.url), 'utf8');
    expect([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1])).toEqual(['zod/v4', './contract.js']);
    expect(source).not.toMatch(/import\(|readFile|fetch\(|failure_signature|oracle_disposition/);
  });
});