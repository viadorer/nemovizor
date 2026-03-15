"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

type UploadingFile = {
  id: string;
  name: string;
  progress: number;
  error?: string;
};

export function ImageDropZone({
  images,
  onImagesChange,
  imageSrc,
  onImageSrcChange,
}: {
  images: string[];
  onImagesChange: (v: string[]) => void;
  imageSrc: string;
  onImageSrcChange: (v: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

  async function uploadFile(file: File): Promise<string | null> {
    if (!ACCEPTED.includes(file.type)) {
      return null;
    }
    if (file.size > MAX_SIZE) {
      return null;
    }

    const id = Math.random().toString(36).slice(2);
    setUploading((prev) => [...prev, { id, name: file.name, progress: 0 }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", "image");

      const xhr = new XMLHttpRequest();
      const url = await new Promise<string | null>((resolve) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, progress: pct } : u)));
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

      setUploading((prev) => prev.filter((u) => u.id !== id));
      return url;
    } catch {
      setUploading((prev) =>
        prev.map((u) => (u.id === id ? { ...u, error: "Chyba" } : u))
      );
      return null;
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(
      (f) => ACCEPTED.includes(f.type) && f.size <= MAX_SIZE
    );

    const urls: string[] = [];
    for (const file of validFiles) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }

    if (urls.length > 0) {
      const newImages = [...images, ...urls];
      onImagesChange(newImages);
      // Auto-set main image if empty
      if (!imageSrc) {
        onImageSrcChange(newImages[0]);
      }
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
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function addUrl() {
    const url = urlInput.trim();
    if (url && !images.includes(url)) {
      const newImages = [...images, url];
      onImagesChange(newImages);
      if (!imageSrc) onImageSrcChange(url);
    }
    setUrlInput("");
  }

  function removeImage(idx: number) {
    const removed = images[idx];
    const newImages = images.filter((_, i) => i !== idx);
    onImagesChange(newImages);
    if (imageSrc === removed) {
      onImageSrcChange(newImages[0] || "");
    }
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const arr = [...images];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onImagesChange(arr);
  }

  function moveDown(idx: number) {
    if (idx === images.length - 1) return;
    const arr = [...images];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onImagesChange(arr);
  }

  function setAsMain(url: string) {
    onImageSrcChange(url);
  }

  return (
    <div className="pf-dropzone-wrap">
      {/* Drop zone */}
      <div
        className={`pf-dropzone${dragging ? " pf-dropzone--active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>{"P\u0159et\u00e1hn\u011bte fotky sem nebo klikn\u011bte pro v\u00fdb\u011br"}</span>
        <span className="pf-dropzone__hint">JPG, PNG, WebP (max 10 MB)</span>
      </div>

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="pf-upload-list">
          {uploading.map((u) => (
            <div key={u.id} className="pf-upload-item">
              <span className="pf-upload-name">{u.name}</span>
              {u.error ? (
                <span className="pf-upload-error">{u.error}</span>
              ) : (
                <div className="pf-upload-progress">
                  <div className="pf-upload-progress__bar" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gallery thumbnails */}
      {images.length > 0 && (
        <div className="pf-gallery-grid">
          {images.map((url, i) => (
            <div key={i} className={`pf-gallery-item${url === imageSrc ? " pf-gallery-item--main" : ""}`}>
              <img src={url} alt={`Foto ${i + 1}`} />
              {url === imageSrc && (
                <span className="pf-gallery-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
              )}
              <div className="pf-gallery-actions">
                {url !== imageSrc && (
                  <button type="button" onClick={() => setAsMain(url)} title={"Nastavit jako hlavn\u00ed"}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                )}
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} title="Nahoru">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === images.length - 1} title="Dol\u016f">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <button type="button" onClick={() => removeImage(i)} title="Odebrat" className="pf-gallery-remove">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* URL fallback input */}
      <div className="pf-tags-input" style={{ marginTop: 8 }}>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder={"Nebo vlo\u017ete URL fotky..."}
        />
        <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={addUrl}>
          {"P\u0159idat URL"}
        </button>
      </div>
    </div>
  );
}
