import { NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/api/rate-limit'
import { consumeCredits } from '@/lib/billing/actions'
import { generateText } from '@/lib/generate/actions'
import { fail, ok } from '@/lib/api/response'

export async function POST(request: Request) {
  return withRateLimit(request, async (req, userId) => {
    const formData = await req.formData()

    // Generate content
    const result = await generateText(formData, userId)

    if (!result.success) {
      return fail(result.error ?? 'Generation failed', 400, result.code ?? 'GENERATION_FAILED')
    }

    // Consume credits (1 credit per generation)
    const creditResult = await consumeCredits(userId, 1, 'text-generation')

    if (!creditResult.success) {
      return fail(`Insufficient credits. Remaining: ${creditResult.remaining}`, 402, 'INSUFFICIENT_CREDITS')
    }

    return ok({
      ...result.data,
      creditsRemaining: creditResult.remaining,
    })
  })
}
