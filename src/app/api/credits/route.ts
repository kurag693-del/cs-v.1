import { NextResponse } from 'next/server'
import { checkCredits } from '@/lib/billing/actions'
import { fail, ok } from '@/lib/api/response'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return fail('userId is required', 400, 'MISSING_USER_ID')
  }

  const credits = await checkCredits(userId)

  return ok(credits)
}
