'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen">
      <section className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            Креатив-студия
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered social media content studio. Generate, schedule, and analyze content with brand voice adaptation.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => router.push('/register')}
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => router.push('/dashboard')}
            >
              Learn More
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <Card>
            <CardContent className="pt-6">
              <CardTitle className="text-xl mb-2">Text Generation</CardTitle>
              <CardDescription>Create engaging posts for any platform with AI-powered content generation.</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <CardTitle className="text-xl mb-2">Image Generation</CardTitle>
              <CardDescription>Generate stunning visuals with integrated AI image creation tools.</CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <CardTitle className="text-xl mb-2">Smart Scheduling</CardTitle>
              <CardDescription>Automate your content calendar with optimal posting time recommendations.</CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
