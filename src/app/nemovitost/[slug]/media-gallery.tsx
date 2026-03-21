"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useT } from "@/i18n/provider";

type MediaTab = "photos" | "video" | "3d";

type MediaGalleryProps = {
  images: string[];
  alt: string;
  videoUrl?: string;
  matterportUrl?: string;
};

function getYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}

export function MediaGallery({
  images,
  alt,
  videoUrl,
  matterportUrl,
}: MediaGalleryProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<MediaTab>("photos");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const hasTabs = Boolean(videoUrl || matterportUrl);

  const tabs: { key: MediaTab; label: string }[] = [
    { key: "photos", label: t.gallery.photos },
    ...(videoUrl ? [{ key: "video" as MediaTab, label: t.gallery.video }] : []),
    ...(matterportUrl
      ? [{ key: "3d" as MediaTab, label: t.gallery.tour3d }]
      : []),
  ];

  // Max 3 visible in grid (1 main + 2 side)
  const visibleCount = Math.min(images.length, 3);
  const extraCount = images.length - visibleCount;

  // Mobile carousel state
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselTouch = useRef<{ x: number; t: number } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const carouselPrev = useCallback(() => setCarouselIdx((i) => Math.max(0, i - 1)), []);
  const carouselNext = useCallback(() => setCarouselIdx((i) => Math.min(images.length - 1, i + 1)), [images.length]);

  return (
    <>
      {hasTabs && (
        <div className="mg-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`mg-tab${activeTab === tab.key ? " mg-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "photos" && (
        <>
          {/* Desktop grid */}
          <div
            className={`mg-grid mg-grid--${Math.min(images.length, 5)}`}
            role="group"
            aria-label={t.gallery.photoGallery}
          >
            {images.slice(0, visibleCount).map((src, i) => (
              <button
                key={i}
                className={`mg-cell${i === 0 ? " mg-cell--main" : ""}`}
                onClick={() => setLightboxIndex(i)}
                aria-label={`${t.gallery.showPhoto} ${i + 1} / ${images.length}`}
              >
                <img src={src} alt={`${alt} - foto ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
                {i === visibleCount - 1 && extraCount > 0 && (
                  <span className="mg-more">+ {extraCount} {t.gallery.morePhotos}</span>
                )}
              </button>
            ))}
          </div>

          {/* Mobile swipe carousel */}
          <div
            className="mg-carousel"
            ref={carouselRef}
            onTouchStart={(e) => {
              carouselTouch.current = { x: e.touches[0].clientX, t: Date.now() };
            }}
            onTouchEnd={(e) => {
              if (!carouselTouch.current) return;
              const dx = e.changedTouches[0].clientX - carouselTouch.current.x;
              if (Math.abs(dx) > 40) {
                if (dx > 0) carouselPrev();
                else carouselNext();
              }
              carouselTouch.current = null;
            }}
            onClick={() => setLightboxIndex(carouselIdx)}
          >
            <div
              className="mg-carousel-track"
              style={{ transform: `translateX(-${carouselIdx * 100}%)` }}
            >
              {images.map((src, i) => (
                <div key={i} className="mg-carousel-slide">
                  <img src={src} alt={`${alt} - foto ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <>
                {carouselIdx > 0 && (
                  <button className="mg-carousel-btn mg-carousel-btn--prev" onClick={(e) => { e.stopPropagation(); carouselPrev(); }} aria-label={t.gallery.previous}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                )}
                {carouselIdx < images.length - 1 && (
                  <button className="mg-carousel-btn mg-carousel-btn--next" onClick={(e) => { e.stopPropagation(); carouselNext(); }} aria-label={t.gallery.next}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                )}
                <div className="mg-carousel-counter">{carouselIdx + 1} / {images.length}</div>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "video" && videoUrl && <VideoEmbed url={videoUrl} videoTourLabel={t.gallery.videoTour} videoNotSupported={t.gallery.videoNotSupported} />}
      {activeTab === "3d" && matterportUrl && (
        <MatterportEmbed url={matterportUrl} tour3dLabel={t.gallery.tour3d} />
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          labels={{ close: t.gallery.close, previous: t.gallery.previous, next: t.gallery.next, photo: t.gallery.showPhoto, thumbnail: t.gallery.thumbnail }}
        />
      )}
    </>
  );
}

function VideoEmbed({ url, videoTourLabel, videoNotSupported }: { url: string; videoTourLabel: string; videoNotSupported: string }) {
  const youtubeId = getYoutubeId(url);
  const vimeoId = getVimeoId(url);

  if (youtubeId) {
    return (
      <div className="mg-embed">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
          title={videoTourLabel}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className="mg-embed">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          title={videoTourLabel}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="mg-embed">
      <video controls preload="metadata" src={url}>
        {videoNotSupported}
      </video>
    </div>
  );
}

function MatterportEmbed({ url, tour3dLabel }: { url: string; tour3dLabel: string }) {
  return (
    <div className="mg-embed">
      <iframe
        src={url}
        title={tour3dLabel}
        allow="xr-spatial-tracking"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

function Lightbox({
  images,
  startIndex,
  onClose,
  labels,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
  labels: { close: string; previous: string; next: string; photo: string; thumbnail: string };
}) {
  const [index, setIndex] = useState(startIndex);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const prev = useCallback(() => {
    setSlideDir("right");
    setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const next = useCallback(() => {
    setSlideDir("left");
    setIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  // Reset slide animation
  useEffect(() => {
    if (slideDir) {
      const t = setTimeout(() => setSlideDir(null), 250);
      return () => clearTimeout(t);
    }
  }, [slideDir, index]);

  useEffect(() => {
    const saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = saved;
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, prev, next]);

  // Preload adjacent
  useEffect(() => {
    const preload = (i: number) => {
      if (i >= 0 && i < images.length) {
        const img = new Image();
        img.src = images[i];
      }
    };
    preload(index - 1);
    preload(index + 1);
  }, [index, images]);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    swiped.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStart.current || swiped.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    // If horizontal swipe is dominant, prevent vertical scroll
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
      e.preventDefault();
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    // Swipe: horizontal > vertical, distance > 40px or velocity > 0.3px/ms
    if (Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > 40 || Math.abs(dx) / dt > 0.3)) {
      swiped.current = true;
      if (dx > 0) prev();
      else next();
    }
    touchStart.current = null;
  }

  function handleOverlayClick(e: React.MouseEvent) {
    // Only close if clicking the dark overlay background, not image or buttons
    if (e.target === e.currentTarget) onClose();
  }

  const slideClass = slideDir === "left" ? " lb-slide-left" : slideDir === "right" ? " lb-slide-right" : "";

  return (
    <div
      className="lb-overlay"
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="lb-counter">
        {index + 1} / {images.length}
      </div>

      <button className="lb-close" onClick={onClose} aria-label={labels.close}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {images.length > 1 && (
        <button
          className="lb-nav lb-nav--prev"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label={labels.previous}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      <img
        ref={imgRef}
        className={`lb-image${slideClass}`}
        src={images[index]}
        alt={`${labels.photo} ${index + 1}`}
        draggable={false}
      />

      {images.length > 1 && (
        <button
          className="lb-nav lb-nav--next"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label={labels.next}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="lb-thumbs">
          {images.map((src, i) => (
            <button
              key={i}
              className={`lb-thumb${i === index ? " lb-thumb--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setSlideDir(i > index ? "left" : "right"); setIndex(i); }}
            >
              <img src={src} alt={`${labels.thumbnail} ${i + 1}`} loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
