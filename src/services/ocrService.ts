/**
 * ocrService.ts — Tesseract.js integration layer with spatial item detection.
 *
 * Pipeline:
 *   raw image → preprocess (4× scale + white text isolation + raw pixel cache)
 *             → Tesseract PSM 11 + digit whitelist
 *             → Spatial item detection (identifies green potion bottles)
 *             → structured OCRResult
 */

import * as Tesseract from 'tesseract.js';
import {
  preprocessForOCR,
  countGreenPixelsAbove,
  OCR_SCALE_FACTOR,
} from '@/utils/imagePreprocessor';
import type { DetectedWord } from '@/types/ocr';

export type ProgressCallback = (progress: number) => void;

export interface OCRResult {
  text: string;
  confidence: number;
  words?: DetectedWord[];
}

/**
 * Extracts text from an image using Tesseract.js (English OCR).
 *
 * @param source     — File, Blob, or image URL
 * @param onProgress — Optional callback receiving progress 0–100
 */
export async function extractTextFromImage(
  source: File | Blob | string,
  onProgress?: ProgressCallback
): Promise<OCRResult> {
  onProgress?.(0);

  let processedSource: Blob | string = source instanceof Blob ? source : source;
  let rawImageData: ImageData | undefined;

  if (source instanceof Blob) {
    try {
      onProgress?.(3);
      const pre = await preprocessForOCR(source);
      processedSource = pre.blob;
      rawImageData = pre.rawImageData;
      onProgress?.(8);
    } catch {
      processedSource = source;
    }
  }

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (!onProgress) return;
      switch (m.status) {
        case 'loading tesseract core':       onProgress(10); break;
        case 'initializing tesseract':       onProgress(14); break;
        case 'loading language traineddata': onProgress(18); break;
        case 'initializing api':             onProgress(22); break;
        case 'recognizing text':
          onProgress(22 + Math.round(m.progress * 73));
          break;
        default: break;
      }
    },
  });

  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.',
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
  });

  const blob = processedSource instanceof Blob ? processedSource : null;
  const imageUrl = blob ? URL.createObjectURL(blob) : (processedSource as string);

  try {
    const result = await worker.recognize(imageUrl, {}, { blocks: true });
    onProgress?.(100);

    const words: DetectedWord[] = [];
    for (const b of result.data.blocks || []) {
      for (const p of b.paragraphs || []) {
        for (const l of p.lines || []) {
          for (const w of l.words || []) {
            const origX = Math.round((w.bbox.x0 + w.bbox.x1) / (2 * OCR_SCALE_FACTOR));
            const origY = Math.round((w.bbox.y0 + w.bbox.y1) / (2 * OCR_SCALE_FACTOR));
            const origW = Math.round((w.bbox.x1 - w.bbox.x0) / OCR_SCALE_FACTOR);
            const origH = Math.round((w.bbox.y1 - w.bbox.y0) / OCR_SCALE_FACTOR);

            let isPotion = false;
            if (rawImageData) {
              const greenCount = countGreenPixelsAbove(rawImageData, origX, origY);
              // Potion bottles have bright green liquid
              if (greenCount >= 40) {
                isPotion = true;
              }
            }

            words.push({
              text: w.text,
              confidence: w.confidence,
              origX,
              origY,
              origW,
              origH,
              isPotion,
            });
          }
        }
      }
    }

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words,
    };
  } finally {
    if (blob) URL.revokeObjectURL(imageUrl);
    await worker.terminate();
  }
}
