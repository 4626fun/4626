export function shouldResumeDeploySession({
  driveContinue,
  nextAction,
  now,
  lastContinueAttemptAt,
}) {
  return (
    driveContinue &&
    nextAction === 'resume' &&
    now - lastContinueAttemptAt > 12_000
  )
}
