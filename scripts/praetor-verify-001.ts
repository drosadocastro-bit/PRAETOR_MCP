import { G0_FIXTURES } from '../experiments/praetor_verify_001/fixtures.js';
import { calculateMetrics, evaluateClaims } from '../experiments/praetor_verify_001/evaluate.js';

const records = evaluateClaims(G0_FIXTURES);
const metrics = calculateMetrics(records, G0_FIXTURES);

process.stdout.write(`${JSON.stringify({
  instrument: 'PRAETOR-VERIFY-001',
  status: 'PILOT / INSTRUMENT VALIDATION ONLY',
  synthetic: true,
  records,
  metrics
}, null, 2)}\n`);