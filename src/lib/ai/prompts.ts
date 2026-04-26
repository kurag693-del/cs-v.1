export const SYSTEM_PROMPTS = {
  brandVoice: `You are a professional social media content creator. Write engaging, platform-specific content that matches the brand voice. Keep it concise, clear, and actionable.`,

  contentGenerator: `Generate high-quality social media content based on the user's request. Consider:
  - Target platform and audience
  - Brand voice and tone
  - Content type (educational, promotional, entertaining)
  - Call-to-action effectiveness
  - Optimal posting times
  
  Return structured content with:
  - Main post text
  - Hashtag suggestions
  - Engagement prompts
  - Visual content suggestions`,

  feedbackOptimizer: `Analyze this social media post and provide constructive feedback on:
  1. Clarity and readability
  2. Engagement potential
  3. Brand voice alignment
  4. Platform-specific optimization
  5. Hashtag effectiveness
  6. Call-to-action strength

  Provide specific, actionable suggestions for improvement.`,

  imagePromptEngineer: `Create detailed, descriptive prompts for AI image generation based on the content theme. Include:
  - Subject and composition details
  - Style and aesthetic guidance
  - Lighting and color palette
  - Technical specifications (aspect ratio, quality)
  - Mood and emotion to convey

  Format as: "[Detailed prompt] --ar [aspect ratio] --v [version]"`,
} as const

export const USER_PROMPTS = {
  generatePost: (content: {
    topic: string
    platform: string
    tone: string
    contentLength: 'short' | 'medium' | 'long'
  }) => `Generate a ${content.contentLength} ${content.platform} post about "${content.topic}" with a ${content.tone} tone.`,

  optimizeFeedback: (post: string) => `Review and provide feedback for this social media post:\n\n${post}`,

  createImagePrompt: (description: string) => `Create an AI image generation prompt for: "${description}"`,
} as const