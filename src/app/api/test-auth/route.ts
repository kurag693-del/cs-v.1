import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/auth/supabase'

export async function GET(request: Request) {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  if (!hasSupabaseConfig) {
    return NextResponse.json({
      success: true,
      mode: 'local',
      user: null,
      error: null,
      headers: {
        'x-user-id': request.headers.get('x-user-id'),
        'x-user-email': request.headers.get('x-user-email'),
      },
      note: 'Supabase env is not configured in this environment.',
    })
  }

  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    return NextResponse.json({
      success: true,
      mode: 'supabase',
      user: user ? { id: user.id, email: user.email } : null,
      error: error?.message || null,
      headers: {
        'x-user-id': request.headers.get('x-user-id'),
        'x-user-email': request.headers.get('x-user-email'),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: 'supabase',
        user: null,
        error: error instanceof Error ? error.message : 'Unexpected auth check error',
        headers: {
          'x-user-id': request.headers.get('x-user-id'),
          'x-user-email': request.headers.get('x-user-email'),
        },
      },
      { status: 500 }
    )
  }
}
