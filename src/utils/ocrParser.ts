/**
 * ocrParser.ts — Pure functions to extract game values from raw OCR text and detected items.
 *
 * Game format:
 * ─ Thousands separator: "." (Vietnamese/European) → "1.000" = 1000, "1.065" = 1065, "1.762" = 1762
 * ─ AP potion screen has 4 potion tiers in fixed order:
 *     1: 50 AP | 2: 100 AP | 3: 500 AP | 4: 1.000 AP
 * ─ Honor screen:
 *     "Bảng Danh Dự" header
 *     "[rank]  [name]  #[serverID]  [honor]"
 */

import type { APPotionPair, APScanResult, HonorScanResult, DetectedWord } from '@/types/ocr';

/** AP costs that exist in-game in fixed natural order */
export const KNOWN_AP_COSTS = [50, 100, 500, 1000] as const;

// ─── OCR text normalisation ───────────────────────────────────────────────────

/**
 * Corrects common OCR character substitutions in digit contexts.
 */
export function cleanOCRText(raw: string): string {
  return raw
    .replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, '0')   // O/o adjacent to digits → 0
    .replace(/(?<=\d)[lI]|[lI](?=\d)/g, '1')   // l/I adjacent to digits → 1
    .replace(/(?<=\d)[Ss]|[Ss](?=\d)/g, '5')   // S/s adjacent to digits → 5
    .replace(/(?<=\d)[Bb]|[Bb](?=\d)/g, '8')   // B/b adjacent to digits → 8
    .replace(/(?<=\d),(?=\d{3}(?!\d))/g, '.') // comma-thousands → dot: "11,040" → "11.040"
    // Merge space-separated thousands: "11 040" → "11.040"
    .replace(/(\d{1,3}) (\d{3})(?!\d)/g, '$1.$2');
}

// ─── Number parsing ───────────────────────────────────────────────────────────

/**
 * Parses a game number string.
 * Handles Vietnamese dot-thousands: "1.000"→1000, "1.065"→1065, "3.122"→3122, "1.762"→1762.
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
 * Principles:
 * 1. The 4 AP potions always correspond to [50, 100, 500, 1000] in that fixed order.
 * 2. In full inventory screens, green potion bottles isolate AP potions from other items.
 * 3. In cropped potion screens, the quantities from left-to-right map directly to [50, 100, 500, 1000].
 * 4. Never shift quantities based on partial cost detection.
 */
export function parseAPScreen(rawText: string, words?: DetectedWord[]): APScanResult {
  // ── Strategy 1: Spatial & Word Detection ────────────────────────────────────
  if (words && words.length > 0) {
    // Filter to valid number words
    const validWords = words.filter((w) => {
      const num = parseGameNumber(w.text);
      return !isNaN(num) && num >= 0 && w.text !== '.';
    });

    // Potion words identified by green bottle liquid above the number
    const potionWords = validWords.filter((w) => w.isPotion);

    // If 2 or more potion words were detected:
    if (potionWords.length >= 2) {
      potionWords.sort((a, b) => {
        const rowA = Math.floor(a.origY / 50);
        const rowB = Math.floor(b.origY / 50);
        if (rowA !== rowB) return rowA - rowB;
        return a.origX - b.origX;
      });

      const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, idx) => ({
        cost,
        quantity: potionWords[idx] ? parseGameNumber(potionWords[idx].text) || 0 : 0,
      }));

      return {
        potions,
        totalAP: potions.reduce((s, p) => s + p.cost * p.quantity, 0),
      };
    }

    // If all valid words can be sorted in reading order:
    validWords.sort((a, b) => {
      const rowA = Math.floor(a.origY / 50);
      const rowB = Math.floor(b.origY / 50);
      if (rowA !== rowB) return rowA - rowB;
      return a.origX - b.origX;
    });

    // If exactly 4 numbers exist in the crop: map directly to [50, 100, 500, 1000]
    if (validWords.length === 4) {
      const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, idx) => ({
        cost,
        quantity: parseGameNumber(validWords[idx].text) || 0,
      }));

      return {
        potions,
        totalAP: potions.reduce((s, p) => s + p.cost * p.quantity, 0),
      };
    }
  }

  // ── Strategy 2: Raw Numbers Sequence ─────────────────────────────────────────
  const allNumbers = extractAllNumbers(rawText);

  // If exactly 4 numbers exist: direct 1-to-1 mapping
  if (allNumbers.length === 4) {
    const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, idx) => ({
      cost,
      quantity: allNumbers[idx] ?? 0,
    }));
    return {
      potions,
      totalAP: potions.reduce((s, p) => s + p.cost * p.quantity, 0),
    };
  }

  // If 8 numbers exist (4 labels + 4 quantities): the bottom 4 are quantities
  if (allNumbers.length === 8) {
    const quantities = allNumbers.slice(4);
    const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, idx) => ({
      cost,
      quantity: quantities[idx] ?? 0,
    }));
    return {
      potions,
      totalAP: potions.reduce((s, p) => s + p.cost * p.quantity, 0),
    };
  }

  // Fallback: fill whatever numbers exist into slots [50, 100, 500, 1000]
  if (allNumbers.length > 0) {
    const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, idx) => ({
      cost,
      quantity: allNumbers[idx] ?? 0,
    }));
    return {
      potions,
      totalAP: potions.reduce((s, p) => s + p.cost * p.quantity, 0),
    };
  }

  return {
    potions: KNOWN_AP_COSTS.map((cost) => ({ cost, quantity: 0 })),
    totalAP: 0,
  };
}

// ─── Honor Screen parser ──────────────────────────────────────────────────────

/**
 * Parses a "Bảng Danh Dự" (Honor Board) screen.
 */
export function parseHonorScreen(rawText: string): HonorScanResult {
  const allNumbers = extractAllNumbers(rawText);

  if (allNumbers.length === 0) {
    return { honorValue: 0, confidence: 'low' };
  }

  // Strategy 1 (HIGH): Look for server ID (typically 4 digits like 2563)
  const serverIdCandidates = allNumbers.filter((n) => n >= 1000 && n <= 9999);
  if (serverIdCandidates.length > 0) {
    const serverId = serverIdCandidates[0];
    const serverIdIndex = allNumbers.indexOf(serverId);
    const afterServerId = allNumbers.slice(serverIdIndex + 1);

    if (afterServerId.length > 0) {
      const honorValue = afterServerId[0];
      if (Number.isFinite(honorValue) && honorValue >= 0) {
        return { honorValue, confidence: 'high' };
      }
    }
  }

  // Strategy 2 (MEDIUM): Multiples of 10 (Honor points are 10/monster)
  const all10s = allNumbers.filter((n) => n % 10 === 0 && n >= 10);
  if (all10s.length > 0) {
    return { honorValue: Math.max(...all10s), confidence: 'medium' };
  }

  // Last resort: just the largest number
  return { honorValue: Math.max(...allNumbers), confidence: 'low' };
}
