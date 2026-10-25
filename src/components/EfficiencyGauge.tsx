/**
 * EfficiencyGauge — Visual progress bar showing AP efficiency vs. baseline.
 * Color and label change dynamically based on the efficiency tier.
 */

import { getEfficiencyTier, EFFICIENCY_TIER_CONFIG } from '@/utils/apCalculator';

interface EfficiencyGaugeProps {
  rate: number;
}

export function EfficiencyGauge({ rate }: EfficiencyGaugeProps) {
  const tier = getEfficiencyTier(rate);
  const config = EFFICIENCY_TIER_CONFIG[tier];

  // Cap bar display at 150% for visual purposes
  const barWidth = Math.min((rate / 150) * 100, 100);

  return (
    <div className="game-card border border-game-border animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Hiệu Suất So Với Baseline
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full bg-black/30 ${config.textClass}`}>
          {config.label}
        </span>
      </div>

      {/* Percentage display */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`font-mono font-bold text-5xl leading-none ${config.textClass}`}>
          {rate.toFixed(2)}
        </span>
        <span className="text-xl text-gray-400 font-semibold">%</span>
      </div>

      {/* Progress bar track */}
      <div className="relative h-4 bg-black/40 rounded-full overflow-hidden border border-game-border">
        {/* Baseline marker at ~66.67% of the 150% scale */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-500 z-10"
          style={{ left: `${(100 / 150) * 100}%` }}
        />

        {/* Filled bar */}
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            tier === 'over'
              ? 'bg-gradient-to-r from-game-accent to-game-purple'
              : config.barClass
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-600">
        <span>0%</span>
        <span className="text-gray-500">Baseline 100%</span>
        <span>150%+</span>
      </div>

      {/* Baseline reference */}
      <div className="mt-4 pt-4 border-t border-game-border/50 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-gray-500 mb-1">Mức chuẩn</p>
          <p className="text-sm font-mono font-semibold text-gray-300">3 quái / 65 AP</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Của bạn</p>
          <p className={`text-sm font-mono font-semibold ${config.textClass}`}>
            {rate > 0 ? `${((rate / 100) * 3).toFixed(2)} quái / 65 AP` : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Chênh lệch</p>
          <p className={`text-sm font-mono font-semibold ${rate >= 100 ? 'text-game-success' : 'text-game-danger'}`}>
            {rate > 0 ? `${rate >= 100 ? '+' : ''}${(rate - 100).toFixed(2)}%` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
