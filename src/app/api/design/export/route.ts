import { fail, ok } from "@/lib/api/response";
import { validateSession } from "@/lib/auth/lucia";
import { uploadImage } from "@/lib/storage/upload";

export const runtime = "nodejs";

/**
 * POST multipart/form-data: поле `file` — PNG/JPEG/WebP дизайна (до лимита медиа).
 * Дублирует server action uploadImage для клиентов, предпочитающих fetch.
 */
export async function POST(request: Request) {
  const { user } = await validateSession();
  if (!user?.id) {
    return fail("Unauthorized", 401, "UNAUTHORIZED");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Invalid form data", 400, "INVALID_BODY");
  }

  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return fail("Missing file field", 400, "MISSING_FILE");
  }

  const result = await uploadImage(entry, user.id);
  if (!result.success) {
    const status =
      result.error.code === "VALIDATION_ERROR"
        ? 400
        : result.error.code === "S3_CONFIG_ERROR"
          ? 503
          : 500;
    return fail(result.error.message, status, result.error.code);
  }

  return ok(result.data);
}
