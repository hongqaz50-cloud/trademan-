/**
 * ocrParser.ts — Pure functions to extract game values from raw OCR text and detected items.
 *
 * Game format:
 * ─ Thousands separator: "." (Vietnamese/European) → "1.000" = 1000, "1.065" = 1065
 * ─ AP potion screen has 4 potion tiers:
 *     50 AP | 100 AP | 500 AP | 1.000 AP
 * ─ Honor screen:
 *     "Bảng Danh Dự" header
 *     "[rank]  [name]  #[serverID]  [honor]"
 *     e.g. "342  [63DS] Thanos  #2563  810"
 */

import type { APPotionPair, APScanResult, HonorScanResult, DetectedWord } from '@/types/ocr';

/** AP costs that exist in-game */
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
 * Handles Vietnamese dot-thousands: "1.000"→1000, "1.065"→1065, "3.122"→3122.
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
 * Employs a multi-tier fallback:
 * 1. Spatial green potion liquid matching (identifies exact potions from inventory)
 * 2. Cost-and-quantity pairing (if cost labels are in text)
 * 3. 4-number sequence
 * 4. General number mapping
 */
export function parseAPScreen(rawText: string, words?: DetectedWord[]): APScanResult {
  // ── Strategy 1: Green potion bottle detection (spatial matching) ────────────
  if (words && words.length > 0) {
    const potionWords = words.filter((w) => w.isPotion);
    if (potionWords.length > 0) {
      // Sort reading order: row by row (tolerance 55px), then left to right
      potionWords.sort((a, b) => {
        const rowA = Math.floor(a.origY / 55);
        const rowB = Math.floor(b.origY / 55);
        if (rowA !== rowB) return rowA - rowB;
        return a.origX - b.origX;
      });

      const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, idx) => {
        const word = potionWords[idx];
        const qty = word ? parseGameNumber(word.text) : 0;
        return {
          cost,
          quantity: isNaN(qty) || qty < 0 ? 0 : qty,
        };
      });

      const totalAP = potions.reduce((sum, p) => sum + p.cost * p.quantity, 0);
      if (totalAP > 0) {
        return { potions, totalAP };
      }
    }
  }

  // ── Strategy 2: Costs and quantities pairing ─────────────────────────────────
  const allNumbers = extractAllNumbers(rawText);
  const costsSet = new Set<number>(KNOWN_AP_COSTS);
  const foundCosts: number[] = [];
  const foundQuantities: number[] = [];

  for (const num of allNumbers) {
    if (costsSet.has(num)) {
      foundCosts.push(num);
    } else if (num > 0) {
      foundQuantities.push(num);
    }
  }

  if (foundCosts.length > 0) {
    const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost) => {
      const idx = foundCosts.indexOf(cost);
      const qty = idx !== -1 ? (foundQuantities[idx] ?? 0) : 0;
      return { cost, quantity: qty };
    });
    const totalAP = potions.reduce((sum, p) => sum + p.cost * p.quantity, 0);
    return { potions, totalAP };
  }

  // ── Strategy 3: Exactly 4 numbers found in OCR text ─────────────────────────
  if (allNumbers.length === 4) {
    const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, i) => ({
      cost,
      quantity: allNumbers[i] ?? 0,
    }));
    const totalAP = potions.reduce((sum, p) => sum + p.cost * p.quantity, 0);
    return { potions, totalAP };
  }

  // ── Strategy 4: Fallback - populate available numbers into slots ────────────
  if (allNumbers.length > 0) {
    const potions: APPotionPair[] = KNOWN_AP_COSTS.map((cost, i) => ({
      cost,
      quantity: allNumbers[i] ?? 0,
    }));
    const totalAP = potions.reduce((sum, p) => sum + p.cost * p.quantity, 0);
    return { potions, totalAP };
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
