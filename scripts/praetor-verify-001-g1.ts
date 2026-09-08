import { calculateG1Metrics, evaluateG1Pairs, G1_PAIRS } from '../experiments/praetor_verify_001/g1.js';

const records = evaluateG1Pairs(G1_PAIRS);
const metrics = calculateG1Metrics(records, G1_PAIRS);

process.stdout.write(`${JSON.stringify({
  instrument: 'PRAETOR-VERIFY-001',
  phase: 'G1',
  status: 'PILOT / INSTRUMENT VALIDATION ONLY',
  synthetic: true,
  records,
  metrics
}, null, 2)}\n`);