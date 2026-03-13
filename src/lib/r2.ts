// ============================================================
// Nemovizor – Cloudflare R2 Storage
// S3-kompatibilní úložiště pro obrázky a videa nemovitostí
// ============================================================

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ===== Konfigurace =====
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "nemovizor-media";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? ""; // Custom domain: https://media.nemovizor.cz

/** Je R2 nakonfigurovaný? */
export const isR2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

/** S3 klient pro Cloudflare R2 */
const r2Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

// ===== Typy =====
export type MediaType = "image" | "video" | "panorama";

interface UploadOptions {
  /** Obsah souboru */
  buffer: Buffer;
  /** Název souboru (např. "foto-kuchyn.jpg") */
  filename: string;
  /** MIME type (např. "image/jpeg") */
  contentType: string;
  /** Typ média */
  mediaType?: MediaType;
  /** ID nemovitosti — pro organizaci v bucket */
  propertyId?: string;
}

interface UploadResult {
  /** Klíč v R2 bucket */
  key: string;
  /** Veřejná URL k souboru */
  url: string;
  /** Velikost v bytech */
  size: number;
}

// ===== Pomocné funkce =====

/** Generuje unikátní klíč pro soubor v R2 */
function generateKey(filename: string, mediaType: MediaType, propertyId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  const safeName = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 40);

  const folder = propertyId
    ? `properties/${propertyId}/${mediaType}s`
    : `uploads/${mediaType}s`;

  return `${folder}/${timestamp}-${random}-${safeName}.${ext}`;
}

/** Vrátí veřejnou URL pro klíč */
export function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // Fallback — bez custom domain (pouze pro dev)
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
}

// ===== Operace =====

/** Nahraje soubor do R2 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  if (!r2Client) {
    throw new Error("R2 není nakonfigurovaný. Nastavte R2_ACCOUNT_ID, R2_ACCESS_KEY_ID a R2_SECRET_ACCESS_KEY.");
  }

  const { buffer, filename, contentType, mediaType = "image", propertyId } = options;
  const key = generateKey(filename, mediaType, propertyId);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    key,
    url: getPublicUrl(key),
    size: buffer.length,
  };
}

/** Smaže soubor z R2 */
export async function deleteFile(key: string): Promise<void> {
  if (!r2Client) throw new Error("R2 není nakonfigurovaný.");

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/** Smaže všechny soubory nemovitosti */
export async function deletePropertyFiles(propertyId: string): Promise<number> {
  if (!r2Client) throw new Error("R2 není nakonfigurovaný.");

  const prefix = `properties/${propertyId}/`;
  const listed = await r2Client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    })
  );

  const keys = listed.Contents?.map((obj) => obj.Key).filter(Boolean) as string[] ?? [];
  if (keys.length === 0) return 0;

  await Promise.all(keys.map((key) => deleteFile(key)));
  return keys.length;
}

/** Vygeneruje presigned URL pro přímý upload z browseru (bypass serveru) */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  mediaType: MediaType = "image",
  propertyId?: string
): Promise<{ url: string; key: string }> {
  if (!r2Client) throw new Error("R2 není nakonfigurovaný.");

  const key = generateKey(filename, mediaType, propertyId);

  const url = await getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 3600 }
  );

  return { url, key };
}

// ===== Validace =====

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

export function validateFile(
  contentType: string,
  size: number,
  mediaType: MediaType
): { valid: boolean; error?: string } {
  if (mediaType === "image") {
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      return { valid: false, error: `Nepovolený typ obrázku. Povolené: ${ALLOWED_IMAGE_TYPES.join(", ")}` };
    }
    if (size > MAX_IMAGE_SIZE) {
      return { valid: false, error: `Obrázek je příliš velký. Maximum: ${MAX_IMAGE_SIZE / 1024 / 1024} MB` };
    }
  } else if (mediaType === "video") {
    if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
      return { valid: false, error: `Nepovolený typ videa. Povolené: ${ALLOWED_VIDEO_TYPES.join(", ")}` };
    }
    if (size > MAX_VIDEO_SIZE) {
      return { valid: false, error: `Video je příliš velké. Maximum: ${MAX_VIDEO_SIZE / 1024 / 1024} MB` };
    }
  }
  return { valid: true };
}
