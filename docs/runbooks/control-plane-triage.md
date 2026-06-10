# Control Plane Triage Runbook

## Stuck `running`

1. Open Admin Control Plane and load the stuck `operationId`.
2. Inspect keeper jobs for active lease:
   - `claimedBy` should match a worker id.
   - `claimExpiresAt` in the past means lease expired; rerun keeper tick.
3. Run keeper job runner:
   - `npm run keeper:jobs:run` (or admin `/api/admin/keeper/jobs/run` in production).
4. If job succeeded but operation still `running`, check for `transition_race` events in the timeline.

## `manual_review`

1. Read the latest event `data_json` for `keeper_job_partial_success` or policy blocks.
2. For operator actions, verify parsed action payload in operation `input`.
3. Resolve underlying vault/config issue, then re-queue the verb from admin console.

## Lost lease / completion mismatch

Symptoms: job log shows `keeper_job_completion_lost_lease`, or job `succeeded` while stage remains `running`.

1. Confirm no concurrent workers claim the same job id.
2. Check `dedupeKey` collisions across operations.
3. Re-run the operation after lease expiry, or mark failed if attempts exhausted.

## Stuck scan automation

- Scheduled workflow: `.github/workflows/control-plane-stuck-scan.yml`
- Local diagnostic: `npm run control-plane:stuck-scan`
- Fail CI when stuck ops found: `CONTROL_PLANE_STUCK_FAIL_ON_FOUND=1`
- Optional Slack alerts: `CONTROL_PLANE_ALERT_WEBHOOK_URL`
