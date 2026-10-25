/**
 * Pure math utility functions for AP Efficiency calculations.
 * No React dependencies — fully unit-testable in isolation.
 */

import {
  AP_PER_RUN,
  HONOR_PER_MONSTER,
  BASELINE_MONSTERS_PER_RUN,
} from '@/constants/gameConfig';
import type { APFormValues, CalculationResult, EfficiencyTier, FormErrors } from '@/types/calculator';

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates raw form input strings.
 * Returns an error map; empty object means inputs are valid.
 */
export function validateInputs(values: APFormValues): FormErrors {
  const errors: FormErrors = {};

  const ap = parseFloat(values.apSpent);
  const honor = parseFloat(values.honorGained);

  // AP Spent validation
  if (values.apSpent.trim() === '') {
    errors.apSpent = 'Vui lòng nhập số AP đã sử dụng.';
  } else if (isNaN(ap)) {
    errors.apSpent = 'AP phải là một số hợp lệ.';
  } else if (ap <= 0) {
    errors.apSpent = 'AP phải lớn hơn 0.';
  } else if (!isFinite(ap)) {
    errors.apSpent = 'AP không được phép là vô cực.';
  }

  // Honor Gained validation
  if (values.honorGained.trim() === '') {
    errors.honorGained = 'Vui lòng nhập số điểm Danh Dự đã kiếm được.';
  } else if (isNaN(honor)) {
    errors.honorGained = 'Điểm Danh Dự phải là một số hợp lệ.';
  } else if (honor < 0) {
    errors.honorGained = 'Điểm Danh Dự không thể âm.';
  } else if (!isFinite(honor)) {
    errors.honorGained = 'Điểm Danh Dự không được phép là vô cực.';
  }

  return errors;
}

// ─── Core Calculation Functions ───────────────────────────────────────────────

/**
 * Calculates the total number of monsters killed.
 * totalMonsters = honorGained / HONOR_PER_MONSTER
 */
export function calculateTotalMonsters(honorGained: number): number {
  if (!isFinite(honorGained) || honorGained < 0) return 0;
  return honorGained / HONOR_PER_MONSTER;
}

/**
 * Calculates the total number of runs performed.
 * totalRuns = apSpent / AP_PER_RUN
 */
export function calculateTotalRuns(apSpent: number): number {
  if (!isFinite(apSpent) || apSpent <= 0) return 0;
  return apSpent / AP_PER_RUN;
}

/**
 * Calculates average monsters killed per 65-AP run.
 * monstersPerRun = totalMonsters / totalRuns
 */
export function calculateMonstersPerRun(
  totalMonsters: number,
  totalRuns: number
): number {
  if (totalRuns === 0 || !isFinite(totalRuns)) return 0;
  const result = totalMonsters / totalRuns;
  return isFinite(result) ? result : 0;
}

/**
 * Calculates efficiency percentage compared to baseline (3 monsters/run = 100%).
 * efficiencyRate = (monstersPerRun / BASELINE_MONSTERS_PER_RUN) * 100
 */
export function calculateEfficiencyRate(monstersPerRun: number): number {
  if (monstersPerRun <= 0 || !isFinite(monstersPerRun)) return 0;
  const result = (monstersPerRun / BASELINE_MONSTERS_PER_RUN) * 100;
  return isFinite(result) ? result : 0;
}

// ─── Aggregated Entry Point ───────────────────────────────────────────────────

/**
 * Runs all calculations from raw numeric inputs.
 * Returns a complete CalculationResult object.
 */
export function calculateAll(apSpent: number, honorGained: number): CalculationResult {
  const totalMonsters = calculateTotalMonsters(honorGained);
  const totalRuns = calculateTotalRuns(apSpent);
  const monstersPerRun = calculateMonstersPerRun(totalMonsters, totalRuns);
  const efficiencyRate = calculateEfficiencyRate(monstersPerRun);

  return {
    totalMonsters,
    totalRuns,
    monstersPerRun,
    efficiencyRate,
  };
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

/**
 * Classifies an efficiency rate into a named tier for UI rendering.
 */
export function getEfficiencyTier(rate: number): EfficiencyTier {
  if (rate === 0) return 'critical';
  if (rate < 70) return 'critical';
  if (rate < 90) return 'low';
  if (rate < 100) return 'near';
  if (rate === 100) return 'onTarget';
  return 'over';
}

/** Tier display config: label, colors */
export const EFFICIENCY_TIER_CONFIG: Record<
  EfficiencyTier,
  { label: string; textClass: string; barClass: string; glowClass: string }
> = {
  critical: {
    label: '⚠️ Kém hiệu quả',
    textClass: 'text-game-danger',
    barClass: 'bg-game-danger',
    glowClass: 'shadow-glow-red',
  },
  low: {
    label: '📉 Dưới mức chuẩn',
    textClass: 'text-orange-400',
    barClass: 'bg-orange-500',
    glowClass: '',
  },
  near: {
    label: '🔶 Gần mức chuẩn',
    textClass: 'text-game-warning',
    barClass: 'bg-game-warning',
    glowClass: 'shadow-glow-gold',
  },
  onTarget: {
    label: '✅ Đạt mức chuẩn',
    textClass: 'text-game-success',
    barClass: 'bg-game-success',
    glowClass: 'shadow-glow-green',
  },
  over: {
    label: '🔥 Vượt mức chuẩn!',
    textClass: 'text-game-accent',
    barClass: 'bg-gradient-accent',
    glowClass: 'shadow-glow-cyan',
  },
};

/**
 * Formats a number to fixed decimal places, trimming trailing zeros.
 */
export function formatNumber(value: number, decimals = 2): string {
  if (!isFinite(value) || isNaN(value)) return '0';
  return parseFloat(value.toFixed(decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}
