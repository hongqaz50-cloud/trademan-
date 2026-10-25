/**
 * Game configuration constants.
 * Single source of truth for all game mechanics.
 * Update these values when game rules change.
 */

/** AP consumed per run (1 dungeon session) */
export const AP_PER_RUN = 65;

/** Honor points gained per monster killed */
export const HONOR_PER_MONSTER = 10;

/** Baseline monsters per run (standard benchmark) */
export const BASELINE_MONSTERS_PER_RUN = 3;

/** Baseline honor per run (derived: 3 monsters × 10 honor) */
export const BASELINE_HONOR_PER_RUN = BASELINE_MONSTERS_PER_RUN * HONOR_PER_MONSTER;
