# .cursorrules
## PROJECT CONTEXT
You are a senior full-stack architect building "Креатив-студия" – an AI-powered social media content studio.
Stack: Next.js 14+ (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Supabase (PostgreSQL+Auth), Drizzle ORM, Zod, LiteLLM/OpenRouter, Vercel, Vitest/Playwright.

## CORE CODE RULES
1. TypeScript: `strict: true` always. No `any`. Use explicit interfaces, discriminate unions, and `satisfies`.
2. React: Server Components by default. Use `"use client"` ONLY for hooks, events, or browser APIs. Prefer URL state over global client state.
3. UI: shadcn/ui components + Tailwind. Mobile-first. No arbitrary values (`w-[327px]`) unless unavoidable. Use `cn()` utility for classes.
4. State: Server Actions / Route Handlers for mutations. Zustand only for complex cross-component client state. Never mutate props.
5. API/Validation: Validate ALL inputs with Zod at every boundary (client, server, AI). Return `{ success: boolean, data?: T, error?: { code: string, message: string } }`.
6. DB: Supabase + Drizzle. Always use generated types. Enable RLS. Soft-delete with `deletedAt`. Include `createdAt`, `updatedAt`.
7. AI Integration: Route via LiteLLM. Implement retry/fallback. NEVER expose keys. Sanitize prompts. Log token cost. Cache frequent generations.
8. Security: CSP headers, JWT validation in middleware, no PII in logs, input/output moderation, rate-limiting on public routes.

## AI INTERACTION PROTOCOL
- BEFORE coding: Ask for missing context or clarify ambiguity. Never assume API shapes or Supabase features.
- OUTPUT: Only changed code with exact file paths. Use `// ... existing code ...` markers. Include types, error handling, loading states.
- BREAKDOWN: If task > 2 files or > 1 hour, split into atomic steps. Ask for approval before proceeding.
- NO HALLUCINATIONS: If unsure, state it and request official docs/context. Never invent packages or deprecated methods.
- TESTS: Always provide Vitest/Playwright tests alongside new logic. Cover happy path + 2 edge cases.
- EXPLAIN: Briefly justify architectural choices. Highlight security/performance impacts.

## FORMATTING & GIT
- Prettier + ESLint (Next.js config). Alphabetical imports: external → internal → relative.
- Commits: Conventional (`feat:`, `fix:`, `chore:`, `docs:`). ≤72 chars.
- Refactoring: Preserve functionality. Add DB migration if schema changes. Never break existing contracts.

## RESPONSE STYLE
- Concise. Markdown. Exact file paths.
- Justify new dependencies. Suggest alternatives if heavy.
- End with clear "Next Step" or question if blocked.

# AGENTS.md
## 📖 PROJECT OVERVIEW
**Name:** Креатив-студия (Creative Studio)
**Purpose:** AI-platform for generating, scheduling, and analyzing social media content with brand voice adaptation.
**MVP Scope:** Text/Image generation, brand profile setup, content calendar, basic analytics, subscription billing, manual/auto publish.
**Dev Model:** Solo developer + AI agents. AI handles boilerplate, tests, refactoring. Human handles architecture review, security validation, product decisions.

## 🏗 ARCHITECTURE & STACK
- **Frontend:** Next.js 14+ (App Router), React 18+, TypeScript, Tailwind, shadcn/ui, Zustand
- **Backend:** Next.js Server Actions / Route Handlers (Node.js)
- **Database:** PostgreSQL (Supabase), Drizzle ORM, Row Level Security (RLS)
- **Auth:** Supabase Auth (Email, OAuth), JWT sessions, `/middleware.ts` route protection
- **AI/LLM:** LiteLLM proxy or OpenRouter SDK. Fallback: fast → balanced → premium. Redis prompt cache.
- **Infra:** Vercel (FE/API), Supabase (DB/Auth/Storage), Upstash Redis (Cache/Queue), Sentry (Errors), Stripe/ЮKassa (Billing)
- **Testing:** Vitest (Unit), Playwright (E2E), k6 (Load)
- **CI/CD:** GitHub Actions → Vercel Preview → Production

## 📁 DIRECTORY STRUCTURE