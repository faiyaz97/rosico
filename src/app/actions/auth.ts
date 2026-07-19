"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  emailSchema,
  loginSchema,
  passwordSchema,
  registerSchema
} from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { getDb, profiles } from "@/db";
import { eq } from "drizzle-orm";
import { requireActor } from "@/lib/server/authorization";
import { safeInternalPath } from "@/lib/navigation";
import {
  deletePrivateImage,
  normaliseImage,
  uploadPrivateImage
} from "@/lib/media/images";

export type AuthActionState = {
  error?: string;
  success?: string;
  fields?: Record<string, string>;
};

function values(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)])
  );
}

export async function registerAction(
  _previous: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const input = values(formData);
  const parsed = registerSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details.",
      fields: {
        displayName: input.displayName ?? "",
        email: input.email ?? ""
      }
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/app`
    }
  });

  if (error) {
    return { error: error.message, fields: { email: parsed.data.email } };
  }

  redirect("/login?message=Check your email to confirm your account.");
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const input = values(formData);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details.",
      fields: { email: input.email ?? "" }
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: "The email or password is incorrect.",
      fields: { email: parsed.data.email }
    };
  }

  redirect(safeInternalPath(input.next));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(
  _previous: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
  });

  return {
    success:
      "If an account exists for that email, a password reset link is on its way."
  };
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data
  });
  if (error) {
    return { error: error.message };
  }
  return { success: "Your password has been updated." };
}

export async function updateProfileAction(
  _previous: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (displayName.length < 2 || displayName.length > 80) {
    return {
      error: "Display name must be between 2 and 80 characters.",
      fields: { displayName }
    };
  }

  const actor = await requireActor();
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      await normaliseImage(file);
    } catch (uploadError) {
      return {
        error:
          uploadError instanceof Error
            ? uploadError.message
            : "The image could not be processed.",
        fields: { displayName }
      };
    }
  }
  let uploadedPath: string | undefined;
  if (file instanceof File && file.size > 0) {
    try {
      const uploaded = await uploadPrivateImage(
        "profiles",
        actor.user.id,
        file
      );
      uploadedPath = uploaded.path;
    } catch (uploadError) {
      return {
        error:
          uploadError instanceof Error
            ? uploadError.message
            : "The image could not be uploaded.",
        fields: { displayName }
      };
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { display_name: displayName }
  });
  if (error) {
    if (uploadedPath) {
      try {
        await deletePrivateImage(uploadedPath);
      } catch (cleanupError) {
        console.warn("Could not remove an unused profile image.", cleanupError);
      }
    }
    return { error: error.message, fields: { displayName } };
  }

  const imagePath = uploadedPath ?? actor.profile.imagePath;
  try {
    await getDb()
      .update(profiles)
      .set({ displayName, imagePath, updatedAt: new Date() })
      .where(eq(profiles.id, actor.user.id));
  } catch {
    await supabase.auth.updateUser({
      data: { display_name: actor.profile.displayName }
    });
    if (uploadedPath) {
      try {
        await deletePrivateImage(uploadedPath);
      } catch (cleanupError) {
        console.warn("Could not remove an unused profile image.", cleanupError);
      }
    }
    return {
      error: "Account settings could not be updated.",
      fields: { displayName }
    };
  }
  if (uploadedPath && actor.profile.imagePath) {
    try {
      await deletePrivateImage(actor.profile.imagePath);
    } catch (cleanupError) {
      console.warn("Could not remove replaced profile image.", cleanupError);
    }
  }
  revalidatePath("/app", "layout");
  return { success: "Account settings updated." };
}
