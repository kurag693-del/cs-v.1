'use server'

import { prisma } from '@/lib/db'
import { createClient } from '@/lib/auth/supabase'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { routeModel, type GenerationTask, type RouteDecision } from '@/lib/ai/router'
import { moderator } from '@/lib/ai/moderation'
import { trackTokenUsage, calculateCost } from '@/lib/ai/utils'
import type { GenerationResult } from '@/lib/ai/types'

const GenerateInputSchema = z.object({
  type: z.enum(['social_post', 'blog_outline', 'ad_copy', 'image_prompt', 'feedback_optimizer', 'brand_voice']),
  prompt: z.string().min(5, 'Prompt must be at least 5 characters').max(5000, 'Prompt must not exceed 5000 characters'),
  platform: z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE']).optional(),
  brandId: z.string().optional(),
  profileId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function generateText(
  formData: FormData,
  userId: string
): Promise<GenerationResult> {
  try {
    // 1. Validate input
    const validated = GenerateInputSchema.safeParse({
      type: formData.get('type'),
      prompt: formData.get('prompt'),
      platform: formData.get('platform'),
      brandId: formData.get('brandId'),
      profileId: formData.get('profileId'),
      metadata: formData.get('metadata'),
    })

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message ?? 'Validation error',
        code: 'VALIDATION_ERROR',
      }
    }

    const { type, prompt, platform, brandId, profileId, metadata } = validated.data

    // 2. Fetch user and profile with credits
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
        code: 'AUTH_ERROR',
      }
    }

    // Verify user matches session
    if (user.id !== userId) {
      return {
        success: false,
        error: 'User mismatch',
        code: 'AUTH_ERROR',
      }
    }

    // Get profile with credits (subscriptions table in Prisma)
    const dbProfile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    })

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    })

    if (!subscription) {
      // Create default free subscription
      await prisma.subscription.create({
        data: {
          userId,
          tier: 'FREE',
          status: 'ACTIVE',
          generationLimit: 100,
          postLimit: 50,
        },
      })
    }

    const credits = subscription?.generationLimit || 100
    const usedGenerations = await prisma.generation.count({
      where: { userId, status: 'COMPLETED' },
    })

    const remainingCredits = credits - usedGenerations

    // 3. Check credits
    if (remainingCredits <= 0) {
      return {
        success: false,
        error: 'Insufficient credits. Please upgrade your plan.',
        code: 'INSUFFICIENT_CREDITS',
      }
    }

    // 4. Moderation check
    const moderationResult = await moderator.moderateContent(prompt)

    if (!moderationResult.isApproved) {
      // Record the blocked generation
      await prisma.generation.create({
        data: {
          userId,
          profileId: profileId,
          type,
          prompt,
          status: 'FAILED',
          error: `Blocked by moderation: ${moderationResult.reason}`,
          metadata: ({
            moderation: moderationResult,
            ...metadata,
          } as unknown as Prisma.InputJsonValue),
          model: 'moderation_block',
          tokens: 0,
        },
      })

      return {
        success: false,
        error: `Content blocked: ${moderationResult.reason}`,
        code: 'CONTENT_BLOCKED',
      }
    }

    // 5. Route model selection
    const route: RouteDecision = routeModel(type, subscription?.tier || 'FREE')

    // 6. Fetch brand if brandId provided
    let brand = null
    if (brandId) {
      brand = await prisma.brand.findUnique({
        where: { id: brandId, userId, deletedAt: null },
      })
    }

    // 7. Build enhanced prompt using prompt library
    const enhancedPrompt = buildPrompt(
      type,
      prompt,
      route.model,
      brand,
      platform,
      dbProfile || undefined
    )

    // 8. Estimate costs
    const estimatedTokens = 1500 // average response
    const estimatedCost = calculateCost(estimatedTokens, route.model)

    // 9. Create generation record (pending)
    const generation = await prisma.generation.create({
      data: {
        userId,
        profileId: profileId || dbProfile?.id || null,
        brandId: brandId || null,
        type,
        prompt: enhancedPrompt,
        status: 'PROCESSING',
        model: route.model,
        tokens: 0,
        metadata: ({
          moderation: moderationResult,
          route,
          platform,
          estimatedCost,
          ...metadata,
        } as unknown as Prisma.InputJsonValue),
      },
    })

    // 10. Simulate LLM call (in production: call LiteLLM/OpenRouter)
    // For now, simulate based on type
    const generatedContent = simulateGeneration(type, enhancedPrompt, route)

    // 11. Update generation with result
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED' as const,
        output: generatedContent,
        tokens: estimatedTokens,
        metadata: ({
          ...(typeof generation.metadata === 'object' && generation.metadata ? generation.metadata : {}),
          completedAt: new Date(),
          actualCost: estimatedCost,
        } as unknown as Prisma.InputJsonValue),
      },
    })

    // 12. Track token usage
    trackTokenUsage(
      { promptTokens: 500, completionTokens: 1000, totalTokens: estimatedTokens },
      estimatedCost
    )

    // 13. Re-sync subscription credits (count COMPLETED generations)
    revalidatePath('/dashboard/generate')

    return {
      success: true,
      data: {
        generationId: generation.id,
        content: generatedContent,
        model: route.model,
        tokens: {
          promptTokens: 500,
          completionTokens: 1000,
          totalTokens: estimatedTokens,
          estimatedCostUSD: estimatedCost,
        },
        costUSD: estimatedCost,
      },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    console.error('Generation error:', err)
    return {
      success: false,
      error: message,
      code: 'INTERNAL_ERROR',
    }
  }
}

// Build enhanced prompt using prompt library
function buildPrompt(
  type: GenerationTask,
  prompt: string,
  model: string,
  brand: { name?: string; voice?: string | null; tone?: string | null; forbiddenWords?: string[] } | null,
  platform: string | undefined,
  profile: { brandVoice?: string | null } | undefined
): string {
  let systemContext = ''

  if (brand) {
    systemContext += `Brand: ${brand.name}\n`
    systemContext += `Voice: ${brand.voice || 'Professional'}\n`
    systemContext += `Tone: ${brand.tone || 'Friendly'}\n`
    const forbiddenWords = brand.forbiddenWords ?? []
    if (forbiddenWords.length > 0) {
      systemContext += `Avoid: ${forbiddenWords.join(', ')}\n`
    }
  }

  if (profile?.brandVoice) {
    systemContext += `Brand Voice: ${profile.brandVoice}\n`
  }

  if (platform) {
    systemContext += `Platform: ${platform}\nOptimize for ${platform} formatting and character limits.\n`
  }

  return `${systemContext}\nTask: ${type}\nPrompt: ${prompt}`
}

// Simulate generation (in production: call actual LLM via LiteLLM/OpenRouter)
function simulateGeneration(type: GenerationTask, prompt: string, route: RouteDecision): string {
  const templates: Record<GenerationTask, string> = {
    social_post: `🚀 ${prompt.substring(0, 50)}...\n\n✨ Key points:\n• Generated by ${route.model}\n• Optimized for engagement\n• Ready to post\n\n#ContentCreation #AI`,
    blog_outline: `# ${prompt}\n\n## Introduction\n- Hook and context\n\n## Main Points\n1. First major point\n2. Second major point\n3. Third major point\n\n## Conclusion\n- Summary and call to action\n\n*Generated by ${route.model}*`,
    ad_copy: `🔥 ${prompt}\n\n✨ Why choose us:\n• Quality guaranteed\n• Fast delivery\n• 24/7 support\n\n👉 Click to learn more!`,
    image_prompt: `A detailed visual representation of "${prompt}", professional quality, highly detailed, 8k resolution, photorealistic --ar 16:9`,
    feedback_optimizer: `✅ Original: ${prompt}\n\n📝 Optimized version:\n${prompt}\n\n💡 Suggestions:\n• Break into shorter sentences\n• Add bullet points for readability\n• Include a clear call-to-action`,
    brand_voice: `Brand Voice Profile for "${prompt}":\n\nTone: Professional yet approachable\nStyle: Clear, concise, engaging\nAudience: Tech-savvy professionals\nKey phrases: "Innovative", "Reliable", "Forward-thinking"\n\nExample posts:\n- "Excited to announce our latest feature! 🚀"
- "Here's how we're solving [problem]"`,
  }

  return templates[type] || `Generated content for: ${prompt}`
}
