"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useT } from "@/i18n/provider";

type SingleImageUploadProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** "round" for broker photos, "square" for logos */
  shape?: "round" | "square";
  /** Preview size in px */
  size?: number;
};

export function SingleImageUpload({
  label,
  value,
  onChange,
  shape = "square",
  size = 96,
}: SingleImageUploadProps) {
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 10 * 1024 * 1024;
  const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
  const borderRadius = shape === "round" ? "50%" : 8;

  async function uploadFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setError(t.admin.allowedFormats);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t.admin.maxFileSize);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", "image");

      const url = await new Promise<string | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url || null);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
        xhr.addEventListener("error", () => resolve(null));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      if (url) {
        onChange(url);
      } else {
        setError(t.admin.uploadErrorGeneric);
      }
    } catch {
      setError(t.admin.uploadErrorGeneric);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleRemove() {
    onChange("");
    setError(null);
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        {/* Preview / Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            width: size,
            height: size,
            borderRadius,
            border: dragging
              ? "2px dashed var(--primary, #4f46e5)"
              : value
              ? "1px solid var(--border, #e5e7eb)"
              : "2px dashed var(--border, #d1d5db)",
            background: dragging
              ? "var(--primary-light, #eef2ff)"
              : "var(--bg-muted, #f9fafb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            overflow: "hidden",
            position: "relative",
            flexShrink: 0,
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          {uploading ? (
            <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "3px solid var(--border, #e5e7eb)",
                borderTopColor: "var(--primary, #4f46e5)",
                animation: "spin 0.8s linear infinite",
              }} />
              <div style={{ marginTop: 4 }}>{progress}%</div>
            </div>
          ) : value ? (
            <img
              src={value}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </div>

        {/* Info + actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {t.admin.dragOrClick}
          </span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {t.admin.dropzoneHint}
          </span>

          {error && (
            <span style={{ fontSize: "0.75rem", color: "var(--danger, #ef4444)" }}>
              {error}
            </span>
          )}

          {value && (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--sm"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              >
                {t.admin.change}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger admin-btn--sm"
                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
              >
                {t.admin.remove}
              </button>
            </div>
          )}

          {value && (
            <div style={{
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              wordBreak: "break-all",
              maxWidth: 300,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {value}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
