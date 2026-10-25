/**
 * imagePreprocessor.ts — Canvas-based image preprocessing for OCR accuracy.
 *
 * Strategy: "White text isolation"
 * ─────────────────────────────────
 * AP quantity numbers (4.045, 4.542, 191, 95) appear as WHITE text on a DARK banner.
 * Honor values (810, 11.040) appear as WHITE text on a DARK golden banner.
 *
 * Algorithm:
 *  1. Scale up 4× with nearest-neighbor (keeps text edges sharp)
 *  2. For each pixel:
 *     - If ALL channels > WHITE_THRESHOLD → this is white/bright text → set to BLACK (0,0,0)
 *     - Otherwise → game art / background → set to WHITE (255,255,255)
 *  3. Result: black text on white background = optimal for Tesseract
 *
 * Why not just grayscale + contrast?
 * Game icons have colorful art (green, orange, red) that creates noise after
 * grayscale conversion. Isolating only white pixels avoids this problem.
 */

/** Scale factor — larger = better Tesseract accuracy (needs text ≥ 20px) */
const SCALE_FACTOR = 4;

/**
 * Minimum channel value (0–255) to be considered "white/bright text".
 * Set conservatively to 200 so we don't catch yellowish or greenish game UI.
 * Only pure white and near-white pixels (like UI text) will match.
 */
const WHITE_THRESHOLD = 200;

/**
 * Preprocesses an image Blob for better Tesseract OCR accuracy.
 *
 * Isolates bright/white text against a clean white background
 * to maximize contrast for Tesseract's character recognition.
 *
 * @param source — Input image as a Blob (PNG, JPG, WebP)
 * @returns Preprocessed PNG blob suitable for Tesseract
 */
export async function preprocessForOCR(source: Blob): Promise<Blob> {
  // ── Step 1: Decode the image ──────────────────────────────────────────────
  const bitmap = await createImageBitmap(source);

  // ── Step 2: Scale up with nearest-neighbor (no blurring of text edges) ───
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width * SCALE_FACTOR;
  canvas.height = bitmap.height * SCALE_FACTOR;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false; // nearest-neighbor → sharp pixel edges
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // ── Step 3: White text isolation ──────────────────────────────────────────
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // A pixel is "white text" only if ALL three channels are above the threshold.
    // This avoids matching bright-green, bright-yellow, or bright-orange game art.
    const isWhiteText = r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD;

    // White text → black (makes it visible on white background for Tesseract)
    // Everything else → white (clean background)
    const val = isWhiteText ? 0 : 255;

    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255; // fully opaque
  }

  ctx.putImageData(imageData, 0, 0);

  // ── Step 4: Export as PNG blob ────────────────────────────────────────────
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/png'
    );
  });
}
