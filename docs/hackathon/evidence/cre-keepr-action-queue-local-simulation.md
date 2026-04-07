# CRE Simulation Evidence — keepr-action-queue (local-simulation)

Command run from `cre/cre-workflows`:

```bash
cre workflow simulate ./keepr-action-queue --target local-simulation
```

Captured output excerpt:

```text
Workflow compiled
2026-03-01T05:52:22Z [SIMULATION] Simulator Initialized
2026-03-01T05:52:22Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2026-03-01T05:52:22Z [USER LOG] Keepr action queue starting
2026-03-01T05:52:22Z [USER LOG] Keepr action queue complete: processed=0 succeeded=0 failed=0 retried=0 skipped=0

Workflow Simulation Result:
 {
  "failed": 0,
  "processed": 0,
  "retried": 0,
  "skipped": 0,
  "succeeded": 0
}
```
