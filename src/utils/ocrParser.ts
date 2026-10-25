/**
 * ocrParser.ts — Pure functions to extract game values from raw OCR text.
 *
 * Game format (from user's screenshots):
 * ─ Thousands separator: "." (Vietnamese/European) → "1.000" = 1000
 * ─ AP potion screen has 2 rows:
 *     Row 1 (top):    50 | 100 | 500 | 1.000    ← AP costs
 *     Row 2 (bottom): 4.045 | 4.542 | 191 | 95  ← quantities
 * ─ Honor screen:
 *     "Bảng Danh Dự" header
 *     "[rank]  [name]  #[serverID]  [honor]"
 *     e.g. "342  [63DS] Thanos  #2563  810"
 *
 * Robustness notes:
 * ─ OCR may output thousands with space: "11 040" → treat as 11040
 * ─ OCR may use comma: "11,040" → treat as 11040
 * ─ OCR may confuse O/0, l/1, I/1, S/5 in digit context
 *
 * No React dependencies — fully unit-testable.
 */

import type { APPotionPair, APScanResult, HonorScanResult } from '@/types/ocr';

/** AP costs that exist in-game. Used to separate costs from quantities. */
const KNOWN_AP_COSTS = new Set([50, 100, 500, 1000]);

// ─── OCR text normalisation ───────────────────────────────────────────────────

/**
 * Corrects common OCR character substitutions in digit contexts.
 */
export function cleanOCRText(raw: string): string {
  return raw
    .replace(/(?<=\d)[Oo](?=\d)/g, '0')   // O/o between digits → 0
    .replace(/(?<=\d)[lI](?=\d)/g, '1')    // l/I between digits → 1
    .replace(/(?<=\d)[Ss](?=\d)/g, '5')    // S/s between digits → 5
    .replace(/(?<=\d)[Bb](?=\d)/g, '8')    // B/b between digits → 8
    .replace(/(?<=\d),(?=\d{3}(?!\d))/g, '.') // comma-thousands → dot: "11,040" → "11.040"
    // Merge space-separated thousands: "11 040" → "11.040"
    .replace(/(\d{1,3}) (\d{3})(?!\d)/g, '$1.$2');
}

// ─── Number parsing ───────────────────────────────────────────────────────────

/**
 * Parses a game number string.
 * Handles Vietnamese dot-thousands: "1.000"→1000, "4.045"→4045, "11.040"→11040.
 * Simple integers pass through: "191"→191, "95"→95.
 */
export function parseGameNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '');
  if (!cleaned) return NaN;

  // Remove dot-thousands separators (dot followed by exactly 3 digits)
  const normalized = cleaned.replace(/\.(?=\d{3}(?!\d))/g, '');

  const value = parseInt(normalized, 10);
  return isNaN(value) ? NaN : value;
}

// ─── Number extraction ────────────────────────────────────────────────────────

/**
 * Extracts all valid game numbers from OCR output.
 * Applies text cleanup first (OCR fixes + space/comma-thousands merge).
 */
export function extractAllNumbers(text: string): number[] {
  const cleaned = cleanOCRText(text);

  // Match: 1-digit groups, optionally followed by .XXX thousands groups
  const matches = cleaned.match(/\d{1,3}(?:\.\d{3})*/g) ?? [];

  return matches
    .map(parseGameNumber)
    .filter((n): n is number => Number.isFinite(n) && n >= 0);
}

// ─── AP Screen parser ─────────────────────────────────────────────────────────

/**
 * Parses an AP potion selection screen.
 *
 * Strategy:
 *  1. Extract all numbers from OCR text
 *  2. Numbers matching KNOWN_AP_COSTS → potion AP values (top row)
 *  3. All other positive integers → quantities (bottom row)
 *  4. Zip pairs → Σ(cost × qty)
 *
 * With PSM 11 + digit whitelist, Tesseract should read both rows reliably.
 */
export function parseAPScreen(rawText: string): APScanResult {
  const allNumbers = extractAllNumbers(rawText);

  const costs: number[] = [];
  const quantities: number[] = [];

  for (const num of allNumbers) {
    if (KNOWN_AP_COSTS.has(num)) {
      costs.push(num);
    } else if (num > 0) {
      quantities.push(num);
    }
  }

  // Pair costs with their quantities by index (same left-to-right order)
  const potions: APPotionPair[] = costs.map((cost, i) => ({
    cost,
    quantity: quantities[i] ?? 0,
  }));

  const totalAP = potions.reduce((sum, p) => sum + p.cost * p.quantity, 0);

  return { potions, totalAP };
}

// ─── Honor Screen parser ──────────────────────────────────────────────────────

/**
 * Parses a "Bảng Danh Dự" (Honor Board) screen.
 *
 * With digit whitelist active, OCR output looks like a sequence of numbers:
 *   "342 2563 810"   (rank | serverID | honor)
 *   "132 2563 11040" or "132 2563 11.040"
 *
 * Strategies (tried in order):
 * 1. HIGH:   Three-number pattern: rank, serverID, honor → pick the third
 * 2. MEDIUM: Largest number divisible by 10 that isn't a 4-digit server ID
 * 3. LOW:    Largest number divisible by 10
 */
export function parseHonorScreen(rawText: string): HonorScanResult {
  const allNumbers = extractAllNumbers(rawText);

  if (allNumbers.length === 0) {
    return { honorValue: 0, confidence: 'low' };
  }

  // Strategy 1 (HIGH): Exactly 3 numbers in image = rank, serverID, honor
  // Server IDs tend to be 4-digit numbers (e.g., 2563)
  const serverIdCandidates = allNumbers.filter((n) => n >= 1000 && n <= 9999);
  if (serverIdCandidates.length > 0) {
    const serverId = serverIdCandidates[0];
    const serverIdIndex = allNumbers.indexOf(serverId);
    const afterServerId = allNumbers.slice(serverIdIndex + 1);

    // The honor value is the first number after the server ID
    if (afterServerId.length > 0) {
      const honorValue = afterServerId[0];
      if (Number.isFinite(honorValue) && honorValue >= 0) {
        return { honorValue, confidence: 'high' };
      }
    }
  }

  // Strategy 2 (MEDIUM): Largest multiple-of-10, excluding 4-digit server IDs
  const honorCandidates = allNumbers.filter(
    (n) => n % 10 === 0 && n >= 10 && !(n >= 1000 && n <= 9999)
  );
  if (honorCandidates.length > 0) {
    return { honorValue: Math.max(...honorCandidates), confidence: 'medium' };
  }

  // Strategy 3 (LOW): Largest multiple-of-10 overall
  const all10s = allNumbers.filter((n) => n % 10 === 0 && n >= 10);
  if (all10s.length > 0) {
    return { honorValue: Math.max(...all10s), confidence: 'low' };
  }

  // Last resort: just the largest number
  return { honorValue: Math.max(...allNumbers), confidence: 'low' };
}
