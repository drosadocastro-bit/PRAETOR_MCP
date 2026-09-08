# G3A Adaptive Search Instrument Selection

Local, offline, synthetic instrument validation only. G3B remains unauthorized,
with zero comparative observations and no holdout constructed.

Read [VALIDATION.md](VALIDATION.md) for measured results and limitations,
[PROTOCOL.md](PROTOCOL.md) for the prospective protocol, and
[HUMAN_REVIEW.json](HUMAN_REVIEW.json) for the pending unsigned decision.
The proposal is tabular-v1 under the predeclared audit-complexity rank.
All three candidate methods and all 30 pilot cells are retained.

```powershell
npx vitest run test/praetor-g3a-runtime.test.ts test/praetor-g3a-search.test.ts test/praetor-g3a-pilot.test.ts
npx tsx experiments/praetor_verify_001/g3a/run.ts --replay
```

Run commands from the repository root. Replay requires the frozen Node
v24.13.0 / Windows x64 environment; timing and RSS are outside replay identity.
The --snapshot command reads definitions/hashes only. The --run command was
used once and now refuses to overwrite pilot-v1. Do not delete artifacts to
force another run or overwrite either freeze: a separately reviewed amendment
is required. These files do not provide a G3B execution command.

Preserve exact bytes when archiving or using Git. This workspace warns that
autocrlf may convert generated LF artifacts to CRLF on a later checkout;
such conversion invalidates frozen byte hashes. Do not regenerate manifests
to hide newline conversion. No repository Git configuration was changed here.

The search update takes only strict G3A_TOY_ONLY feedback. Runtime observable
and white-box exposure are tested and recorded separately, not fed into the
toy learner. This is not an adversarial efficacy comparison or evidence of
production PRAETOR vulnerability/resistance. Human acceptance and subsequent
G3B design/feedback integration are still separate work.