// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WaitlistBaseAppWalletNudge } from './WaitlistBaseAppWalletNudge'

describe('WaitlistBaseAppWalletNudge', () => {
  it('prompts to finish step 1 before connecting Base Account', () => {
    render(
      <WaitlistBaseAppWalletNudge
        stepOneComplete={false}
        showConnectPanel={false}
        onGoToStepTwo={vi.fn()}
      />,
    )

    expect(screen.getByText('Connect your Base Account wallet')).toBeTruthy()
    expect(screen.getByText(/Finish Step 1, then connect your Base Account wallet in Step 2/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Step 2' })).toBeTruthy()
  })

  it('calls through to step 2 when connect panel is ready', async () => {
    const user = userEvent.setup()
    const onGoToStepTwo = vi.fn()

    render(
      <WaitlistBaseAppWalletNudge
        stepOneComplete
        showConnectPanel
        onGoToStepTwo={onGoToStepTwo}
      />,
    )

    expect(screen.getByText(/Connect your Base Account wallet in Step 2 to enable sponsored swaps/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Connect in Step 2' }))
    expect(onGoToStepTwo).toHaveBeenCalledTimes(1)
  })
})
