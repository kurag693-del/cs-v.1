import { withRateLimit } from '@/lib/api/rate-limit'
import { consumeCredits } from '@/lib/billing/actions'
import { generateText } from '@/lib/generate/actions'
import { fail, ok } from '@/lib/api/response'

export async function POST(request: Request) {
  return withRateLimit(request, async (req, userId) => {
    const formData = await req.formData()
    const topicValue = formData.get('topic') ?? formData.get('prompt')
    const platformValue = formData.get('platform')
    const brandIdValue = formData.get('brandId')
    const maxLengthValue = formData.get('maxLength')

    const topic = typeof topicValue === 'string' ? topicValue : ''
    const platform = typeof platformValue === 'string' ? platformValue : 'Instagram'
    const brandId = typeof brandIdValue === 'string' && brandIdValue.length > 0 ? brandIdValue : undefined
    const parsedMaxLength = Number(maxLengthValue)
    const maxLength = Number.isFinite(parsedMaxLength) && parsedMaxLength > 0 ? parsedMaxLength : 600

    // Generate content
    const result = await generateText({
      topic,
      platform,
      brandId,
      maxLength,
    })

    if (!result.success) {
      return fail(result.error ?? 'Generation failed', 400, 'GENERATION_FAILED')
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
