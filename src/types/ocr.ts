/**
 * OCR-specific TypeScript types.
 * Centralizes all scanning-related interfaces.
 */

/** 4 scan steps: AP before/after + Honor before/after */
export type ScanStep = 'apBefore' | 'apAfter' | 'honorBefore' | 'honorAfter';

export type ScanConfidence = 'high' | 'medium' | 'low';

/** A single AP potion type with cost and quantity */
export interface APPotionPair {
  cost: number;       // 50 | 100 | 500 | 1000
  quantity: number;   // how many the player has
}

/** Result from scanning an AP potion screen */
export interface APScanResult {
  potions: APPotionPair[];
  totalAP: number;   // Σ(cost × quantity)
}

/** Result from scanning an Honor board screen */
export interface HonorScanResult {
  honorValue: number;
  confidence: ScanConfidence;
}

/** Per-step scan state stored in useImageScanner */
export interface StepScanState {
  previewUrl: string | null;
  isScanning: boolean;
  scanProgress: number;      // 0–100
  scanError: string | null;
  isDone: boolean;
  rawOCRText?: string;        // Raw Tesseract output — for debug display
  apResult?: APScanResult;
  honorResult?: HonorScanResult;
}

/** Aggregated final results computed from all 4 steps */
export interface AggregatedScanResult {
  apBefore: number | null;
  apAfter: number | null;
  apSpent: number | null;          // apBefore - apAfter
  honorBefore: number | null;
  honorAfter: number | null;
  honorGained: number | null;      // honorAfter - honorBefore
  apBeforePotions: APPotionPair[];
  apAfterPotions: APPotionPair[];
}
