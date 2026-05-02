/**
 * Сессии на Prisma (раньше: пакет `lucia` + `@lucia-auth/adapter-prisma`, сняты с npm).
 * См. https://lucia-auth.com/lucia-v3/migrate
 */
import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";

/** Совместимо с прежним Lucia v3 и с `middleware.ts` (проверяются оба имени). */
export const AUTH_SESSION_COOKIE_NAME = "auth_session";
const LEGACY_SESSION_COOKIE_NAME = "session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SEC = Math.floor(SESSION_TTL_MS / 1000);

function sessionCookieOptions(expiresAt: Date): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000) || SESSION_MAX_AGE_SEC
  );
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

function readSessionIdFromCookies(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return (
    cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value ??
    null
  );
}

function setSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, sessionId: string, expiresAt: Date) {
  cookieStore.set(AUTH_SESSION_COOKIE_NAME, sessionId, sessionCookieOptions(expiresAt));
}

function clearSessionCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const blank = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  cookieStore.set(AUTH_SESSION_COOKIE_NAME, "", blank);
  cookieStore.set(LEGACY_SESSION_COOKIE_NAME, "", blank);
}

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function createSession(userId: string) {
  const id = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      id,
      userId,
      expiresAt,
    },
  });
  const cookieStore = await cookies();
  setSessionCookie(cookieStore, id, expiresAt);
  return { id, userId, expiresAt };
}

export async function validateSession(sessionIdOverride?: string | null) {
  const cookieStore = await cookies();
  const sessionId =
    sessionIdOverride ?? readSessionIdFromCookies(cookieStore);

  if (!sessionId) {
    return { session: null, user: null };
  }

  const row = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: { id: true, email: true, name: true, deletedAt: true },
      },
    },
  });

  if (!row || row.user.deletedAt) {
    if (row) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    }
    clearSessionCookies(cookieStore);
    return { session: null, user: null };
  }

  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: sessionId } });
    clearSessionCookies(cookieStore);
    return { session: null, user: null };
  }

  let expiresAt = row.expiresAt;
  const renewAfter = expiresAt.getTime() - SESSION_TTL_MS / 2;
  if (now >= renewAfter) {
    expiresAt = new Date(now + SESSION_TTL_MS);
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt },
    });
    setSessionCookie(cookieStore, sessionId, expiresAt);
  }

  const user: AuthUser = {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
  };

  return {
    session: { id: row.id, userId: row.userId, expiresAt },
    user,
  };
}

export async function invalidateSession() {
  const cookieStore = await cookies();
  const sessionId = readSessionIdFromCookies(cookieStore);
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
  }
  clearSessionCookies(cookieStore);
}

/** Для тестовых маршрутов; имя cookie как у прежнего Lucia. */
export const lucia = {
  sessionCookieName: AUTH_SESSION_COOKIE_NAME,
} as const;
