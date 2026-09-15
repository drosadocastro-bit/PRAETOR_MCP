import { describe, expect, it } from 'vitest';

import { verifyCurrentApplicationBaseline, verifyHistoricalG2Archive } from '../scripts/verify-baselines.js';

describe('historical G2 archive and current runtime baseline', () => {
  it('validates the preserved historical G2 bytes from the cb13110 source archive', () => {
    expect(verifyHistoricalG2Archive()).toMatchObject({
      status: 'HISTORICAL_G2_ARCHIVE_INTACT',
      historical_tree_hash: '850312ba9f944e13c9bb01161e4bf10ce4d70bf421534f6429b92da2fe5db419'
    });
  });

  it('classifies active source changes as intentional application evolution', () => {
    expect(verifyCurrentApplicationBaseline()).toMatchObject({
      status: 'INTENTIONAL_APPLICATION_EVOLUTION',
      baseline_commit: 'cb131103bf20959fe2a30e173052d4407b524019',
      baseline_src_tree_hash: '850312ba9f944e13c9bb01161e4bf10ce4d70bf421534f6429b92da2fe5db419',
      historical_g2_status: 'PASS'
    });
  });
});
