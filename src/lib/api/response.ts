import { NextResponse } from 'next/server'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: code ?? 'REQUEST_FAILED',
        message,
      },
    },
    { status }
  )
}
