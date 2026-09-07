import { confidenceInterval95, HORIZONS, runMatchedHorizonTasks, type HorizonCondition, type HorizonRun, type HorizonTask } from '../src/research/horizonEvaluation.js';

const conditions: HorizonCondition[] = ['A_baseline', 'B_judge_only', 'C_agent_k_only', 'D_agent_k_hybrid'];
const tasks: HorizonTask[] = HORIZONS.flatMap(horizon => Array.from({ length: 100 }, (_, index) => index + 1).map(seed => ({
  task_id: `h${horizon}-seed${seed}`,
  seed,
  horizon
})));
const controlTasks: HorizonTask[] = HORIZONS.flatMap(horizon => Array.from({ length: 100 }, (_, index) => index + 1).map(seed => ({
  task_id: `control-h${horizon}-seed${seed}`,
  seed,
  horizon,
  fault_mode: 'clean_control' as const
})));
const runs = runMatchedHorizonTasks(tasks, conditions);
const controlRuns = runMatchedHorizonTasks(controlTasks, conditions);

function rate(successes: number, trials: number) {
  return confidenceInterval95(successes, trials);
}

function summarize(source: readonly HorizonRun[], horizon: number, condition: HorizonCondition) {
  const selected = source.filter(run => run.task.horizon === horizon && run.condition === condition);
  const taskSuccesses = selected.filter(run => run.metrics.task_success).length;
  const unsafePersistence = selected.filter(run => run.metrics.unsafe_persistence).length;
  const containedErrors = selected.filter(run => run.metrics.first_error_contained).length;
  const firstErrors = selected.filter(run => run.metrics.first_error_step !== null).length;
  const detectedFaults = selected.filter(run => run.metrics.detected_fault);
  const safeRecoveries = detectedFaults.filter(run => run.metrics.safe_recovery).length;
  const outcomeCounts = selected.reduce<Record<string, number>>((counts, run) => {
    const outcome = run.metrics.post_fault_outcome;
    counts[outcome] = (counts[outcome] ?? 0) + 1;
    return counts;
  }, {});
  return {
    horizon,
    condition,
    trials: selected.length,
    task_success_rate: taskSuccesses / selected.length,
    task_success_rate_ci95: rate(taskSuccesses, selected.length),
    first_error_containment_rate: firstErrors === 0 ? 1 : containedErrors / firstErrors,
    first_error_containment_rate_ci95: rate(containedErrors, firstErrors),
    unsafe_persistence_rate: unsafePersistence / selected.length,
    unsafe_persistence_rate_ci95: rate(unsafePersistence, selected.length),
    safe_recovery_given_detected_fault: detectedFaults.length === 0 ? null : safeRecoveries / detectedFaults.length,
    safe_recovery_given_detected_fault_ci95: rate(safeRecoveries, detectedFaults.length),
    detected_faults: detectedFaults.length,
    post_fault_outcomes: outcomeCounts
  };
}

const summary = HORIZONS.flatMap(horizon => conditions.map(condition => summarize(runs, horizon, condition)));
const controlSummary = HORIZONS.flatMap(horizon => conditions.map(condition => summarize(controlRuns, horizon, condition)));
console.log('PRAETOR Horizon-Aware Error-Propagation Evaluation');
console.log('Deterministic synthetic simulator only; these are harness outputs, not model or production claims.');
console.log('Fault-injection matrix: 100 matched seeds per horizon and condition.');
console.log(JSON.stringify(summary, null, 2));
console.log('Clean negative-control matrix: governance is not expected to improve any measured outcome.');
console.log(JSON.stringify(controlSummary, null, 2));

const replay = runMatchedHorizonTasks(tasks, conditions);
const controlReplay = runMatchedHorizonTasks(controlTasks, conditions);
const reproducible = JSON.stringify(runs) === JSON.stringify(replay) && JSON.stringify(controlRuns) === JSON.stringify(controlReplay);
console.log(`Deterministic replay: ${reproducible}. Fault trials: ${runs.length}; control trials: ${controlRuns.length}.`);

function countBy<T>(values: readonly T[]): Map<T, number> {
  return values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<T, number>());
}

const verdicts = countBy(runs.map((run: HorizonRun) => run.metrics.unsafe_persistence ? 'unsafe_persistence' : run.metrics.task_success ? 'task_success' : 'contained_or_ordinary_failure'));
console.log(JSON.stringify(Object.fromEntries(verdicts), null, 2));
