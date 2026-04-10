/**
 * Image download + R2 upload for the Import API.
 * Downloads images from external URLs and uploads them to Cloudflare R2.
 * Handles parallel downloads with concurrency limiting.
 */

import { uploadFile } from "@/lib/r2";

export interface ImageInput {
  url: string;
  title?: string;
  order?: number;
}

export interface ImageResult {
  url: string;
  originalUrl: string;
  order: number;
  ok: boolean;
  error?: string;
}

const CONCURRENCY = 5;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * Download a single image from URL and upload to R2.
 * Returns the R2 public URL or an error.
 */
async function downloadAndUpload(
  img: ImageInput,
  propertyId: string,
  index: number,
): Promise<ImageResult> {
  const order = img.order ?? index;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    const resp = await fetch(img.url, {
      signal: controller.signal,
      headers: { "User-Agent": "Nemovizor-Import/1.0" },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { url: img.url, originalUrl: img.url, order, ok: false, error: `HTTP ${resp.status}` };
    }

    const contentType = resp.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!ALLOWED_TYPES.has(contentType)) {
      // Try using the URL as-is (external hosting)
      return { url: img.url, originalUrl: img.url, order, ok: true };
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_SIZE_BYTES) {
      return { url: img.url, originalUrl: img.url, order, ok: false, error: `File too large: ${(buf.length / 1024 / 1024).toFixed(1)}MB` };
    }

    const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1] || "jpg";
    const filename = img.title
      ? `${img.title.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50)}.${ext}`
      : `photo-${order}.${ext}`;

    const result = await uploadFile({
      buffer: buf,
      filename,
      contentType,
      mediaType: "image",
      propertyId,
    });

    return { url: result.url, originalUrl: img.url, order, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Fallback: use original URL
    return { url: img.url, originalUrl: img.url, order, ok: false, error: message };
  }
}

/**
 * Download and upload multiple images with concurrency limiting.
 * Returns results in the same order as input.
 * Failed downloads return warnings (not errors) — the property still gets imported.
 */
export async function downloadImages(
  images: ImageInput[],
  propertyId: string,
): Promise<{ results: ImageResult[]; warnings: string[] }> {
  if (!images.length) return { results: [], warnings: [] };

  const results: ImageResult[] = [];
  const warnings: string[] = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((img, batchIdx) => downloadAndUpload(img, propertyId, i + batchIdx)),
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
        if (!r.value.ok && r.value.error) {
          warnings.push(`Image ${r.value.originalUrl}: ${r.value.error}`);
        }
      } else {
        warnings.push(`Image download failed: ${r.reason}`);
      }
    }
  }

  // Sort by order
  results.sort((a, b) => a.order - b.order);
  return { results, warnings };
}
