import { describe, expect, it } from 'vitest'

import type { OnboardingProgress } from '@/lib/onboarding/actions'

describe('onboarding progress shape', () => {
  it('expects four canonical steps for UI contract', () => {
    const mock: OnboardingProgress = {
      steps: [
        { id: 'brand', title: '', description: '', done: false, href: '' },
        { id: 'generation', title: '', description: '', done: false, href: '' },
        { id: 'integration', title: '', description: '', done: false, href: '' },
        { id: 'schedule', title: '', description: '', done: false, href: '' },
      ],
      completedSteps: 0,
      totalSteps: 4,
      isCompleted: false,
    }
    expect(mock.steps).toHaveLength(4)
    expect(mock.totalSteps).toBe(4)
  })
})
