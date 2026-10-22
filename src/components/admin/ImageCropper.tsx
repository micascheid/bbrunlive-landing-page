import { useState, useRef, useEffect, useCallback } from 'react';

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 800;
const ASPECT_RATIO = OUTPUT_WIDTH / OUTPUT_HEIGHT; // 3:2 = 1.5

interface ImageCropperProps {
  /** Data URL or public URL of the source image to position/crop */
  sourceUrl: string;
  /** Mime type to export (e.g. image/jpeg, image/png, image/webp) */
  mimeType: string;
  /** Post title & body for the live mobile card preview */
  previewTitle?: string;
  previewBody?: string;
  /** Called whenever the user adjusts position/zoom (debounced) or on initial load */
  onCroppedBlob: (blob: Blob) => void;
  onRemove: () => void;
}

export function ImageCropper({
  sourceUrl,
  mimeType,
  previewTitle,
  previewBody,
  onCroppedBlob,
  onRemove,
}: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);

  const [imgNatural, setImgNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  // panNormalized: x and y in [-1, 1], where 0 is centered, -1 is top/left edge, +1 is bottom/right edge
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Load the image into an offscreen HTMLImageElement for canvas cropping
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImgNatural(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgElementRef.current = img;
      setImgNatural({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = sourceUrl;
  }, [sourceUrl]);

  // Compute crop rectangle in source image coordinates given natural size, zoom, and normalized pan
  const getCropRect = useCallback(
    (naturalWidth: number, naturalHeight: number, currentZoom: number, currentPan: { x: number; y: number }) => {
      const imgAspect = naturalWidth / naturalHeight;

      // Base visible rectangle at zoom = 1 that covers a 3:2 frame
      let baseCropW: number;
      let baseCropH: number;
      if (imgAspect > ASPECT_RATIO) {
        // Image is wider than 3:2 -> height fits, width is cropped
        baseCropH = naturalHeight;
        baseCropW = naturalHeight * ASPECT_RATIO;
      } else {
        // Image is taller/squarer than 3:2 -> width fits, height is cropped
        baseCropW = naturalWidth;
        baseCropH = naturalWidth / ASPECT_RATIO;
      }

      const cropW = baseCropW / currentZoom;
      const cropH = baseCropH / currentZoom;

      const maxOffsetX = Math.max(0, (naturalWidth - cropW) / 2);
      const maxOffsetY = Math.max(0, (naturalHeight - cropH) / 2);

      const centerX = naturalWidth / 2 - currentPan.x * maxOffsetX;
      const centerY = naturalHeight / 2 - currentPan.y * maxOffsetY;

      const sx = Math.max(0, Math.min(naturalWidth - cropW, centerX - cropW / 2));
      const sy = Math.max(0, Math.min(naturalHeight - cropH, centerY - cropH / 2));

      return { sx, sy, sw: cropW, sh: cropH, maxOffsetX, maxOffsetY };
    },
    []
  );

  // Export the cropped 1200x800 (or smaller if source is smaller) 3:2 image whenever pan/zoom changes
  useEffect(() => {
    if (!imgNatural || !imgElementRef.current) return;

    const timer = setTimeout(() => {
      const img = imgElementRef.current;
      if (!img) return;

      const { sx, sy, sw, sh } = getCropRect(imgNatural.width, imgNatural.height, zoom, pan);

      const outW = Math.min(OUTPUT_WIDTH, Math.round(sw));
      const outH = Math.round(outW / ASPECT_RATIO);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const outputMime =
        mimeType === 'image/png' ? 'image/png' : mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (blob) onCroppedBlob(blob);
        },
        outputMime,
        0.88
      );
    }, 120);

    return () => clearTimeout(timer);
  }, [imgNatural, zoom, pan, mimeType, getCropRect, onCroppedBlob]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!imgNatural || !containerRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragStartRef.current || !imgNatural || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const imgAspect = imgNatural.width / imgNatural.height;
    let renderedW: number;
    let renderedH: number;
    if (imgAspect > ASPECT_RATIO) {
      renderedH = rect.height * zoom;
      renderedW = renderedH * imgAspect;
    } else {
      renderedW = rect.width * zoom;
      renderedH = renderedW / imgAspect;
    }

    const maxPanPxX = Math.max(0, (renderedW - rect.width) / 2);
    const maxPanPxY = Math.max(0, (renderedH - rect.height) / 2);

    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    const nextPanX =
      maxPanPxX > 0
        ? Math.max(-1, Math.min(1, dragStartRef.current.startPanX + dx / maxPanPxX))
        : 0;
    const nextPanY =
      maxPanPxY > 0
        ? Math.max(-1, Math.min(1, dragStartRef.current.startPanY + dy / maxPanPxY))
        : 0;

    setPan({ x: nextPanX, y: nextPanY });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }

  // Compute CSS positioning for the live preview inside the 3:2 frame
  let imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  if (imgNatural) {
    const imgAspect = imgNatural.width / imgNatural.height;
    const isWider = imgAspect > ASPECT_RATIO;
    // Scale relative to the 3:2 container
    const widthPct = isWider ? (imgAspect / ASPECT_RATIO) * 100 * zoom : 100 * zoom;
    const heightPct = isWider ? 100 * zoom : (ASPECT_RATIO / imgAspect) * 100 * zoom;

    const maxShiftXPct = Math.max(0, (widthPct - 100) / 2);
    const maxShiftYPct = Math.max(0, (heightPct - 100) / 2);

    const leftPct = 50 - widthPct / 2 + pan.x * maxShiftXPct;
    const topPct = 50 - heightPct / 2 + pan.y * maxShiftYPct;

    imgStyle = {
      position: 'absolute',
      width: `${widthPct}%`,
      height: `${heightPct}%`,
      maxWidth: 'none',
      left: `${leftPct}%`,
      top: `${topPct}%`,
      userSelect: 'none',
      pointerEvents: 'none',
    };
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-surface/50 border border-divider rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Mobile Feed Card Preview (3:2 Frame)
          </span>
          <p className="text-xs text-text-tertiary mt-0.5">
            Drag the photo to reposition how it will appear on a user's phone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(pan.x !== 0 || pan.y !== 0 || zoom !== 1) && (
            <button
              type="button"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(1);
              }}
              className="px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary bg-card border border-divider rounded-lg transition-colors"
            >
              Reset Position
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 border border-error/20 rounded-lg transition-colors"
          >
            Remove Image
          </button>
        </div>
      </div>

      {/* Simulated Mobile Card (matches NewsPostCard.tsx in bb-dashboard-mobile) */}
      <div className="max-w-sm mx-auto bg-card border border-divider rounded-xl overflow-hidden shadow-md">
        {/* 3:2 Interactive Image Frame */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ aspectRatio: '3 / 2', touchAction: 'none' }}
          className={`relative w-full overflow-hidden bg-background/40 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <img src={sourceUrl} alt="Phone preview" draggable={false} style={imgStyle} />

          {/* Subtle drag hint badge */}
          <div className="absolute bottom-2 right-2 pointer-events-none bg-black/60 text-white text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-xs">
            ✥ Drag to reposition
          </div>
        </div>

        {/* Simulated Card Content */}
        <div className="p-4">
          <div className="text-xs text-text-secondary mb-1">{todayFormatted}</div>
          <div className="text-base font-semibold text-text-primary line-clamp-1">
            {previewTitle?.trim() || 'Your post title will appear here'}
          </div>
          <div className="text-sm text-text-secondary mt-1 line-clamp-2">
            {previewBody?.trim() || 'A 3-line preview of your post body text will appear here on the mobile feed card.'}
          </div>
        </div>
      </div>

      {/* Zoom Slider */}
      <div className="max-w-sm mx-auto mt-3 flex items-center gap-3">
        <span className="text-xs text-text-secondary font-medium">Zoom</span>
        <input
          type="range"
          min={1}
          max={2.5}
          step={0.02}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="flex-1 accent-accent cursor-pointer"
          aria-label="Image zoom"
        />
        <span className="text-xs text-text-tertiary w-10 text-right">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
