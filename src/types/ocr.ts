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

/** Detected word bounding box from OCR for spatial analysis */
export interface DetectedWord {
  text: string;
  confidence: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  isPotion?: boolean;
}

/** Result from scanning an AP potion screen */
export interface APScanResult {
  potions: APPotionPair[];
  totalAP: number;   // Σ(cost × quantity)
}

/** Result from scanning an Honor board screen */
export interface HonorScanResult {
  honorValue: number;
  playerName?: string;
  confidence: ScanConfidence;
}

/** Speedup data for single category */
export interface SpeedupItemData {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
  rawStr?: string;
}

/** Complete speedup extraction result from a speedup inventory screen */
export interface SpeedupScanResult {
  universal: SpeedupItemData;
  training: SpeedupItemData;
  healing: SpeedupItemData;
  building?: SpeedupItemData;
  research?: SpeedupItemData;
}

/** Combined batch extraction result from 3 screenshots (AP, Honor, Speedup) */
export interface BatchScanResult {
  ap: APScanResult;
  honor: HonorScanResult;
  speedup: SpeedupScanResult;
  honorImageIndex?: number;
  apImageIndex?: number;
  speedupImageIndex?: number;
}

/** Result from smart single screenshot scan with automatic type classification */
export type SmartScanResult =
  | { type: 'honor'; result: HonorScanResult }
  | { type: 'ap'; result: APScanResult }
  | { type: 'speedup'; result: SpeedupScanResult };

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
  scanMethod?: 'ai' | 'ocr';
  aiError?: string | null;
}

/** Aggregated final results computed from all 4 steps */
export interface AggregatedScanResult {
  apBefore: number | null;
  apAfter: number | null;
  apSpent: number | null;          // apBefore - apAfter
  honorBefore: number | null;
  honorAfter: number | null;
  honorGained: number | null;      // honorAfter - honorBefore
  playerName?: string;
  apBeforePotions: APPotionPair[];
  apAfterPotions: APPotionPair[];
}
