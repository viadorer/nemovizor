import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const env = readFileSync(envPath, "utf8").split("\n").reduce((a, l) => {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) a[m[1]] = m[2];
  return a;
}, {});

console.log("R2_ACCOUNT_ID:", env.R2_ACCOUNT_ID ? "set" : "MISSING");
console.log("R2_ACCESS_KEY_ID:", env.R2_ACCESS_KEY_ID ? "set" : "MISSING");
console.log("R2_SECRET_ACCESS_KEY:", env.R2_SECRET_ACCESS_KEY ? "set" : "MISSING");
console.log("R2_BUCKET_NAME:", env.R2_BUCKET_NAME || "nemovizor-media");
console.log("R2_PUBLIC_URL:", env.R2_PUBLIC_URL || "(not set)");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

// Download test image
console.log("\nDownloading test image from Sreality CDN...");
const img = await fetch(
  "https://d18-a.sdn.cz/d_18/c_img_p8_B/nPVpfd5QLLD53Uiu1FwD4hn/de07.jpeg?fl=res,221,166,3|shr,,20|jpg,90",
  { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.sreality.cz/" } }
);
const buf = Buffer.from(await img.arrayBuffer());
console.log("Downloaded:", buf.byteLength, "bytes");

// Upload to R2
const key = `uploads/images/test-direct-r2-${Date.now()}.jpg`;
console.log("Uploading to R2:", key);
await r2.send(new PutObjectCommand({
  Bucket: env.R2_BUCKET_NAME || "nemovizor-media",
  Key: key,
  Body: buf,
  ContentType: "image/jpeg",
  CacheControl: "public, max-age=31536000, immutable",
}));

const url = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : key;
console.log("OK! Uploaded:", url);
