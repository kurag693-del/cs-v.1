"use server";

import { createClient, type Session, type User } from "@supabase/supabase-js";

import { prisma } from "@/lib/db/prisma";
import { authCredentialsSchema } from "@/lib/validation/auth";

type AuthSuccessResult = {
  success: true;
  data: User;
  user: User;
  session?: Session | null;
  message?: string;
};

type AuthErrorResult = {
  success: false;
  error: string;
};

type AuthResult = AuthSuccessResult | AuthErrorResult;

type SignOutResult = {
  success: boolean;
};

function shouldUseSupabaseAuth(): boolean {
  const mode = process.env.AUTH_MODE?.toLowerCase();
  if (mode === "local") return false;
  if (mode === "supabase") return true;

  return process.env.NODE_ENV === "production";
}

function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function mapLocalUserToSupabaseUser(user: { id: string; email: string }): User {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmation_sent_at: undefined,
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const parsed = authCredentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    if (!shouldUseSupabaseAuth()) {
      const localUser = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true, email: true, password: true },
      });

      if (!localUser || localUser.password !== parsed.data.password) {
        return {
          success: false,
          error: "Invalid login credentials",
        };
      }

      const mappedUser = mapLocalUserToSupabaseUser(localUser);
      return {
        success: true,
        data: mappedUser,
        user: mappedUser,
        session: null,
      };
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message ?? "Failed to sign in",
      };
    }

    return {
      success: true,
      data: data.user,
      user: data.user,
      session: data.session,
    };
  } catch (error: unknown) {
    console.error("signInWithEmail error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const parsed = authCredentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    if (!shouldUseSupabaseAuth()) {
      const existing = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      });

      if (existing) {
        return {
          success: false,
          error: "User already exists",
        };
      }

      const created = await prisma.user.create({
        data: {
          email: parsed.data.email,
          password: parsed.data.password,
          name: parsed.data.email.split("@")[0],
        },
        select: { id: true, email: true },
      });

      const mappedUser = mapLocalUserToSupabaseUser(created);
      return {
        success: true,
        data: mappedUser,
        user: mappedUser,
        message: "Registration successful",
      };
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp(parsed.data);

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message ?? "Failed to sign up",
      };
    }

    return {
      success: true,
      data: data.user,
      user: data.user,
      message: "Registration successful",
    };
  } catch (error: unknown) {
    console.error("signUpWithEmail error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function signOut(): Promise<SignOutResult> {
  try {
    if (!shouldUseSupabaseAuth()) {
      return { success: true };
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("signOut error:", error);
      return { success: false };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("signOut error:", error);
    return { success: false };
  }
}

export async function loginUser(formData: FormData): Promise<AuthResult> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  const email = typeof emailValue === "string" ? emailValue : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  return signInWithEmail(email, password);
}

export async function registerUser(formData: FormData): Promise<AuthResult> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  const email = typeof emailValue === "string" ? emailValue : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  return signUpWithEmail(email, password);
}
