import "server-only";

import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { createAdminClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MEDIA_BUCKET = "media";

export type NormalisedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
};

export async function normaliseImage(file: File): Promise<NormalisedImage> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("Images must be no larger than 5 MB.");
  }

  const source = Buffer.from(await file.arrayBuffer());
  const image = sharp(source, {
    failOn: "warning",
    limitInputPixels: 25_000_000
  });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
    throw new Error("The uploaded file is not a supported image.");
  }

  const buffer = await image
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const output = await sharp(buffer).metadata();
  if (!output.width || !output.height) {
    throw new Error("The image dimensions could not be read.");
  }

  return {
    buffer,
    width: output.width,
    height: output.height,
    mimeType: "image/webp"
  };
}

export async function uploadPrivateImage(
  owner: "profiles" | "groups" | "players" | "competitions" | "tournaments",
  ownerId: string,
  file: File
) {
  const image = await normaliseImage(file);
  const path = `${owner}/${ownerId}/${randomUUID()}.webp`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, image.buffer, {
      contentType: image.mimeType,
      cacheControl: "31536000",
      upsert: false
    });
  if (error) {
    throw new Error("The image could not be uploaded.");
  }
  return { path, width: image.width, height: image.height };
}

export async function createSignedImageUrl(path: string, expiresIn = 300) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) {
    throw new Error("The image is unavailable.");
  }
  return data.signedUrl;
}

export async function deletePrivateImage(path: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) {
    throw new Error("The previous image could not be removed.");
  }
}
