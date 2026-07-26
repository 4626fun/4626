export function shouldResumeDeploySession(input: {
  driveContinue: boolean
  nextAction: unknown
  now: number
  lastContinueAttemptAt: number
}): boolean {
  return (
    input.driveContinue &&
    input.nextAction === 'resume' &&
    input.now - input.lastContinueAttemptAt > 12_000
  )
}
