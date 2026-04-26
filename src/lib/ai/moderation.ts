import type { ModerationResult } from './types'

// Content moderation using LLM-based approach
export class ContentModerator {
  private moderationPrompt: string = `
You are a content moderation system. Analyze the following user prompt and determine if it violates content policies.

POLICIES:
- No hate speech, harassment, or discriminatory content
- No violence, threats, or self-harm
- No sexually explicit content
- No illegal activities or promotion of illegal acts
- No spam or phishing attempts
- No personal information or doxxing
- Respect copyright and intellectual property

Analyze the prompt and return ONLY a JSON object with this structure:
{
  "isApproved": boolean,
  "categories": string[],
  "severity": "low" | "medium" | "high" | "critical",
  "reason": string,
  "flags": string[]
}

USER PROMPT:
{{PROMPT}}

Return JSON only, no additional text.
`

  // In a real implementation, this would fetch from a file
  // For now, using inline prompt
  async moderateContent(prompt: string): Promise<ModerationResult> {
    // Basic keyword filtering (fast path)
    const blockedKeywords = [
      'hate', 'kill', 'die', 'suicide', 'bomb', 'terror',
      'racist', 'nazi', 'slur', 'rape', 'pedophile',
      'ssn', 'social security', 'credit card', 'password'
    ]

    const lowerPrompt = prompt.toLowerCase()
    const foundKeywords = blockedKeywords.filter(kw => lowerPrompt.includes(kw))

    if (foundKeywords.length > 0) {
      return {
        isApproved: false,
        categories: ['violence', 'hate_speech'],
        severity: 'high',
        reason: `Blocked keywords detected: ${foundKeywords.join(', ')}`,
        flags: foundKeywords,
      }
    }

    // For now, simulate LLM moderation (in production, call LiteLLM/OpenRouter)
    // This is a placeholder - would integrate with routeModel() and actual LLM call
    return this.simulateModeration(prompt)
  }

  private async simulateModeration(prompt: string): Promise<ModerationResult> {
    // Simple heuristic-based moderation for demo
    const toxicIndicators = ['fuck', 'shit', 'asshole', 'bitch', 'damn']
    const toxicCount = toxicIndicators.filter(word => 
      prompt.toLowerCase().includes(word)
    ).length

    if (toxicCount >= 3) {
      return {
        isApproved: false,
        categories: ['toxicity'],
        severity: 'medium',
        reason: 'High toxicity detected in prompt',
        flags: ['toxicity'],
      }
    }

    // Length checks
    if (prompt.length < 5) {
      return {
        isApproved: false,
        categories: ['quality'],
        severity: 'low',
        reason: 'Prompt too short',
        flags: ['too_short'],
      }
    }

    if (prompt.length > 5000) {
      return {
        isApproved: false,
        categories: ['quality'],
        severity: 'low',
        reason: 'Prompt exceeds maximum length',
        flags: ['too_long'],
      }
    }

    return {
      isApproved: true,
      categories: [],
      severity: 'low',
      reason: 'Content approved',
      flags: [],
    }
  }
}

export const moderator = new ContentModerator()
