import { z } from 'zod'

// Auth schemas
export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

// Content schemas
export const contentPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  content: z.string().min(1, 'Content is required').max(5000, 'Content must be less than 5000 characters'),
  platform: z.enum(['twitter', 'linkedin', 'facebook', 'instagram', 'tiktok']),
  scheduledAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

// Brand schema
export const brandProfileSchema = z.object({
  name: z.string().min(2, 'Brand name is required'),
  voice: z.enum(['professional', 'casual', 'friendly', 'authoritative', 'playful']),
  tone: z.string().min(10, 'Tone description is required'),
  targetAudience: z.string().min(10, 'Target audience description is required'),
})

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type ContentPostInput = z.infer<typeof contentPostSchema>
export type BrandProfileInput = z.infer<typeof brandProfileSchema>
