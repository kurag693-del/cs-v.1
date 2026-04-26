'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { generateText } from '@/lib/generate/actions'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Check, Copy, Save, Loader2 } from 'lucide-react'
import { BrandSelect } from './BrandSelect'
import { createPost } from '@/lib/posts/actions'

const generateSchema = z.object({
  type: z.enum(['social_post', 'blog_outline', 'ad_copy', 'image_prompt', 'feedback_optimizer', 'brand_voice']),
  prompt: z.string().min(5, 'Prompt must be at least 5 characters').max(5000, 'Prompt must not exceed 5000 characters'),
  platform: z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE']).optional(),
  brandId: z.string().optional(),
})

type GenerateFormData = z.infer<typeof generateSchema>

interface TextGeneratorProps {
  userId: string
  profileId?: string
  availableBrands: Array<{ id: string; name: string }>
  credits: number
}

export function TextGenerator({ userId, profileId, availableBrands, credits }: TextGeneratorProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      type: 'social_post',
      prompt: '',
      platform: 'TWITTER',
    },
  })

  async function onSubmit(data: GenerateFormData) {
    setError(null)
    setResult(null)

    if (credits <= 0) {
      setError('Insufficient credits. Please upgrade your plan.')
      toast({
        title: 'No credits remaining',
        description: 'You need more credits to generate content.',
        variant: 'destructive',
      })
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('type', data.type)
      formData.set('prompt', data.prompt)
      if (data.platform) formData.set('platform', data.platform)
      if (data.brandId) formData.set('brandId', data.brandId)
      if (profileId) formData.set('profileId', profileId)

      const generationResult = await generateText(formData, userId)

      if (generationResult.success && generationResult.data) {
        setResult(generationResult.data)
        toast({
          title: 'Content generated!',
          description: `${generationResult.data.tokens.totalTokens} tokens used`,
          variant: 'default',
        })
      } else {
        const errorMsg = generationResult.error || 'Generation failed'
        setError(errorMsg)
        toast({
          title: 'Generation failed',
          description: errorMsg,
          variant: 'destructive',
        })
      }
    })
  }

  const copyToClipboard = async () => {
    if (result?.content) {
      await navigator.clipboard.writeText(result.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'Copied!',
        description: 'Content copied to clipboard',
      })
    }
  }

  const saveAsDraft = async () => {
    if (!result?.content) {
      toast({
        title: 'Nothing to save',
        description: 'Generate content first',
        variant: 'destructive',
      })
      return
    }

    const values = form.getValues()
    const draftFormData = new FormData()
    draftFormData.set('title', values.prompt.slice(0, 80) || 'AI Draft')
    draftFormData.set('content', result.content)
    draftFormData.set('platform', values.platform ?? 'TWITTER')
    draftFormData.set('mediaUrls', '[]')
    draftFormData.set('brandId', values.brandId ?? '')
    draftFormData.set('metadata', JSON.stringify({ source: 'text-generator', model: result.model }))

    const draftResult = await createPost(draftFormData, userId)
    if (draftResult.success) {
      toast({
        title: 'Saved to drafts',
        description: 'Draft was added to calendar',
      })
      return
    }

    toast({
      title: 'Failed to save',
      description: draftResult.error,
      variant: 'destructive',
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Content</CardTitle>
          <CardDescription>
            Create AI-powered content with your brand voice. Credits remaining: <span className="font-bold">{credits}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="social_post">Social Media Post</SelectItem>
                        <SelectItem value="blog_outline">Blog Outline</SelectItem>
                        <SelectItem value="ad_copy">Ad Copy</SelectItem>
                        <SelectItem value="image_prompt">Image Prompt</SelectItem>
                        <SelectItem value="feedback_optimizer">Feedback Optimizer</SelectItem>
                        <SelectItem value="brand_voice">Brand Voice Guide</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform (optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TWITTER">Twitter / X</SelectItem>
                        <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                        <SelectItem value="FACEBOOK">Facebook</SelectItem>
                        <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                        <SelectItem value="TIKTOK">TikTok</SelectItem>
                        <SelectItem value="YOUTUBE">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand (optional)</FormLabel>
                    <BrandSelect
                      brands={availableBrands}
                      onBrandSelect={field.onChange}
                      selectedBrandId={field.value}
                    />
                    <FormDescription>Use brand voice and style guidelines</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt / Topic *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what you want to generate..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific for better results. Include tone, audience, and key points.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isPending || credits <= 0}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Content'
                )}
              </Button>
            </form>
          </Form>

          {error && (
            <div className="mt-4 rounded-md border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                <strong>Error:</strong> {error}
                {error.includes('402') && (
                  <span>
                    {' '}
                    <a href="/pricing" className="underline">Upgrade your plan</a>
                  </span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
            <CardDescription>
              Model: {result.model} | Tokens: {result.tokens?.totalTokens} | Cost: ${result.costUSD?.toFixed(4)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/50 p-4">
              <pre className="whitespace-pre-wrap text-sm">{result.content}</pre>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <><Check className="mr-2 h-4 w-4" />Copied</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" />Copy</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={saveAsDraft}>
                <Save className="mr-2 h-4 w-4" />Save as Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
