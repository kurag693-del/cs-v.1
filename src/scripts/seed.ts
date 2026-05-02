import { PrismaClient } from '@prisma/client'

declare const process: {
  exit: (code: number) => never
}

const prisma = new PrismaClient()

/**
 * Dev/демо-наполнение. Удаление тестового пользователя: `npm run db:delete-test-users`
 * (по умолчанию email `creator@creativestudio.com`, см. `scripts/delete-test-users.cjs`).
 */
async function main() {
  // Create a user
  const user = await prisma.user.create({
    data: {
      email: 'creator@creativestudio.com',
      name: 'Studio Creator',
      role: 'USER' as const,
      profiles: {
        create: {
          bio: 'AI-powered content creator',
          avatar: 'https://example.com/avatar.jpg',
          brandVoice: 'Professional and engaging',
          tone: 'Friendly and informative',
          targetAudience: 'Tech professionals and entrepreneurs',
          preferences: { theme: 'dark', notifications: true },
        },
      },
      brands: {
        create: [
          {
            name: 'TechFlow',
            description: 'SaaS platform for workflow automation',
            logo: 'https://example.com/techflow-logo.png',
            website: 'https://techflow.com',
            industry: 'SaaS',
            voice: 'Innovative and reliable',
            tone: 'Professional yet approachable',
            colors: ['#3B82F6', '#1E40AF'],
            isActive: true,
          },
          {
            name: 'DataNest',
            description: 'Data analytics and visualization platform',
            logo: 'https://example.com/datanest-logo.png',
            website: 'https://datanest.com',
            industry: 'Data Analytics',
            voice: 'Data-driven and insightful',
            tone: 'Clear and authoritative',
            colors: ['#10B981', '#059669'],
            isActive: true,
          },
        ],
      },
      generations: {
        create: [
          {
            type: 'social_post',
            prompt: 'Create an engaging Twitter post about AI in workflow automation',
            output: '🚀 Revolutionize your workflow with AI-powered automation!\\n\\nSay goodbye to repetitive tasks and hello to creative freedom. Our latest innovation brings intelligent automation to your fingertips.\\n\\n✨ Smart task routing\\n⚡ Real-time processing\\n📊 Predictive analytics\\n\\nReady to level up? #AI #WorkflowAutomation #Productivity #TechFlow',
            tokens: 127,
            model: 'gpt-4o-mini',
            status: 'COMPLETED' as const,
            metadata: { platform: 'TWITTER', estimatedEngagement: 'high' },
          },
          {
            type: 'blog_outline',
            prompt: 'Create a blog outline about data visualization best practices',
            output: '# Data Visualization Best Practices: A Complete Guide\\n\\n## Introduction\\n- Why data viz matters\\n- Common pitfalls\\n\\n## 1. Know Your Audience\\n- Tailoring complexity\\n- Key metrics vs details\\n\\n## 2. Choose the Right Chart\\n- Bar charts for comparisons\\n- Line charts for trends\\n- Scatter plots for correlations\\n\\n## 3. Color Theory\\n- Accessibility first\\n- Color blindness considerations\\n\\n## 4. Storytelling with Data\\n- Narrative flow\\n- Annotation best practices\\n\\n## Conclusion\\n- Key takeaways\\n- Tools to explore\\n\\n---\\n*Generated for DataNest analytics team*',
            tokens: 342,
            model: 'gpt-4o-mini',
            status: 'COMPLETED' as const,
            metadata: { platform: 'BLOG', wordCount: 450 },
          },
          {
            type: 'ad_copy',
            prompt: 'Write LinkedIn ad copy for DataNest analytics platform',
            output: '',
            tokens: 0,
            model: 'gpt-4o-mini',
            status: 'FAILED' as const,
            error: 'API timeout - please retry',
            metadata: { platform: 'LINKEDIN', campaign: 'Q2 Launch' },
          },
        ],
      },
    },
  })

  console.log('✅ Seed data created successfully!')
  console.log('   User:', user.email)
  console.log('   Profiles: 1')
  console.log('   Brands: 2')
  console.log('   Generations: 3')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .then(async () => {
    await prisma.$disconnect()
  })
