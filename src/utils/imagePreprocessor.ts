/**
 * imagePreprocessor.ts — Canvas-based image preprocessing for OCR accuracy.
 *
 * Strategy: "White text isolation" + "Potion liquid spatial detector"
 * ──────────────────────────────────────────────────────────────────
 * AP quantity numbers appear as WHITE text on a DARK banner.
 * Honor values appear as WHITE text on a DARK golden banner.
 *
 * Preprocessing pipeline:
 *  1. Extract raw image pixel data to detect green potion liquid.
 *  2. Scale up 4× with nearest-neighbor (sharp text edges).
 *  3. Isolate white/bright text against a clean white background.
 */

/** Scale factor — larger = better Tesseract accuracy (needs text ≥ 20px) */
export const OCR_SCALE_FACTOR = 4;

/**
 * Minimum channel value (0–255) to be considered "white/bright text".
 * Set to 175 to capture white text even with compression or dimming.
 */
const WHITE_THRESHOLD = 175;

export interface PreprocessResult {
  blob: Blob;
  rawImageData: ImageData;
  scaleFactor: number;
}

/**
 * Checks for bright green potion liquid in the region directly above a detected number.
 * Returns the count of green potion pixels.
 */
export function countGreenPixelsAbove(
  imageData: ImageData,
  centerX: number,
  bottomY: number
): number {
  const { width, height, data } = imageData;
  // Region above the number where the green potion bottle sits
  const yTop = Math.max(0, Math.floor(bottomY - 80));
  const yBot = Math.min(height, Math.floor(bottomY));
  const xLeft = Math.max(0, Math.floor(centerX - 40));
  const xRight = Math.min(width, Math.floor(centerX + 45));

  let greenCount = 0;
  for (let py = yTop; py < yBot; py++) {
    for (let px = xLeft; px < xRight; px++) {
      const idx = (py * width + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Bright green potion liquid: high green channel relative to red and blue
      if (g > 100 && g > r * 1.15 && g > b * 1.15) {
        greenCount++;
      }
    }
  }
  return greenCount;
}

/**
 * Preprocesses an image Blob for better Tesseract OCR accuracy
 * and extracts raw image data for item classification.
 */
export async function preprocessForOCR(source: Blob): Promise<PreprocessResult> {
  const bitmap = await createImageBitmap(source);
  const origWidth = bitmap.width;
  const origHeight = bitmap.height;

  // ── Step 1: Capture raw pixels from original image ────────────────────────
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = origWidth;
  rawCanvas.height = origHeight;
  const rawCtx = rawCanvas.getContext('2d')!;
  rawCtx.drawImage(bitmap, 0, 0);
  const rawImageData = rawCtx.getImageData(0, 0, origWidth, origHeight);

  // ── Step 2: Scale up with nearest-neighbor for OCR ────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = origWidth * OCR_SCALE_FACTOR;
  canvas.height = origHeight * OCR_SCALE_FACTOR;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // ── Step 3: White text isolation ──────────────────────────────────────────
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isWhiteText = r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD;
    const val = isWhiteText ? 0 : 255;

    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // ── Step 4: Export scaled image as PNG blob ───────────────────────────────
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png'
    );
  });

  return {
    blob,
    rawImageData,
    scaleFactor: OCR_SCALE_FACTOR,
  };
}
