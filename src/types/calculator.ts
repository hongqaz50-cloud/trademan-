/**
 * TypeScript type definitions for the AP Efficiency Calculator.
 * Centralizes all shared interfaces to ensure type safety across the app.
 */

/** Raw form input values (strings to support live user input) */
export interface APFormValues {
  apSpent: string;
  honorGained: string;
}

/** Calculated results from the efficiency engine */
export interface CalculationResult {
  /** Total monsters killed: honorGained / HONOR_PER_MONSTER */
  totalMonsters: number;
  /** Total runs performed: apSpent / AP_PER_RUN */
  totalRuns: number;
  /** Average monsters per 65 AP run */
  monstersPerRun: number;
  /** Efficiency % compared to baseline (3 monsters/run = 100%) */
  efficiencyRate: number;
}

/** Validation error messages for form fields */
export interface FormErrors {
  apSpent?: string;
  honorGained?: string;
  general?: string;
}

/** Efficiency tier classification */
export type EfficiencyTier = 'critical' | 'low' | 'near' | 'onTarget' | 'over';
