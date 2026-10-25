/**
 * ocrService.ts — Tesseract.js integration layer.
 *
 * Key improvements for game UI screenshots:
 * - Preprocesses images (3× scale + contrast) before sending to Tesseract
 * - Uses character whitelist (digits + dot only) → fewer misreads
 * - Uses PSM 11 (Sparse Text) → finds numbers anywhere in the image
 * - Returns raw OCR text alongside confidence for debugging
 */

import * as Tesseract from 'tesseract.js';
import { preprocessForOCR } from '@/utils/imagePreprocessor';


export type ProgressCallback = (progress: number) => void;

export interface OCRResult {
  text: string;
  confidence: number; // 0–100, Tesseract's confidence score
}

/**
 * Extracts text from an image using Tesseract.js (English OCR).
 *
 * Pipeline:
 *   raw image → preprocess (3× + grayscale + contrast) → Tesseract → raw text
 *
 * @param source     — File, Blob, or image URL
 * @param onProgress — Optional callback receiving progress 0–100
 */
export async function extractTextFromImage(
  source: File | Blob | string,
  onProgress?: ProgressCallback
): Promise<OCRResult> {
  onProgress?.(0);

  // ── Step 1: Preprocess (only for Blob/File, not URLs) ────────────────────
  let processedSource: Blob | string = source instanceof Blob ? source : source;

  if (source instanceof Blob) {
    try {
      onProgress?.(3);
      processedSource = await preprocessForOCR(source);
      onProgress?.(8);
    } catch {
      // If preprocessing fails, fall back to original
      processedSource = source;
    }
  }

  // ── Step 2: Create Tesseract worker ──────────────────────────────────────
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (!onProgress) return;
      switch (m.status) {
        case 'loading tesseract core':     onProgress(10); break;
        case 'initializing tesseract':     onProgress(14); break;
        case 'loading language traineddata': onProgress(18); break;
        case 'initializing api':           onProgress(22); break;
        case 'recognizing text':
          // Maps recognition progress from 22% → 95%
          onProgress(22 + Math.round(m.progress * 73));
          break;
        default: break;
      }
    },
  });

  // ── Step 3: Configure parameters ─────────────────────────────────────────
  await worker.setParameters({
    // Only recognize digits and dots — dramatically reduces misreads on game UI
    tessedit_char_whitelist: '0123456789.',
    // PSM 11 = Sparse Text: find as much text as possible in no particular order
    // Best for game UIs where numbers are scattered across the image
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
  });

  // ── Step 4: Recognize ─────────────────────────────────────────────────────
  // processedSource is always a Blob here (preprocessForOCR returns Blob,
  // and the fallback also keeps it as a Blob). Use a type guard to satisfy TS.
  const blob = processedSource instanceof Blob ? processedSource : null;
  const imageUrl = blob ? URL.createObjectURL(blob) : (processedSource as string);

  try {
    const result = await worker.recognize(imageUrl);
    onProgress?.(100);

    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } finally {
    if (blob) URL.revokeObjectURL(imageUrl);
    await worker.terminate();
  }
}
