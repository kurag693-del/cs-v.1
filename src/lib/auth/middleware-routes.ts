export type AccessDecision = 'allow' | 'redirect_login'

const PUBLIC_EXACT_ROUTES = new Set(['/login', '/register', '/pricing', '/'])
const PUBLIC_PREFIXES = ['/api/auth', '/api/health', '/_next', '/auth/callback']
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding']

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_ROUTES.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function resolveAccessDecision(pathname: string, hasSessionCookie: boolean): AccessDecision {
  if (!isProtectedPath(pathname)) {
    return 'allow'
  }

  return hasSessionCookie ? 'allow' : 'redirect_login'
}
