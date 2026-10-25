/**
 * ResultsPanel — Displays the full calculation output.
 * Shows 4 MetricCards in a grid + the EfficiencyGauge.
 * Receives a CalculationResult prop; knows nothing about how it was calculated.
 */

import type { CalculationResult } from '@/types/calculator';
import { MetricCard } from '@/components/ui/MetricCard';
import { EfficiencyGauge } from '@/components/EfficiencyGauge';
import { formatNumber } from '@/utils/apCalculator';

interface ResultsPanelProps {
  result: CalculationResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const { totalMonsters, totalRuns, monstersPerRun, efficiencyRate } = result;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          id="metric-total-monsters"
          icon="☠️"
          label="Tổng Quái Đã Hạ"
          value={formatNumber(totalMonsters, 0)}
          unit="con"
          sublabel="honorGained ÷ 10"
          glowColor="gold"
          highlight={true}
        />
        <MetricCard
          id="metric-total-runs"
          icon="🔄"
          label="Tổng Lượt Run"
          value={formatNumber(totalRuns, 2)}
          unit="lượt"
          sublabel="apSpent ÷ 65"
          glowColor="purple"
          highlight={true}
        />
        <MetricCard
          id="metric-monsters-per-run"
          icon="⚔️"
          label="Quái / 65 AP"
          value={formatNumber(monstersPerRun, 2)}
          unit="con/lượt"
          sublabel="Trung bình mỗi run"
          glowColor="cyan"
          highlight={true}
        />
        <MetricCard
          id="metric-efficiency-rate"
          icon="📈"
          label="Hiệu Suất"
          value={formatNumber(efficiencyRate, 2)}
          unit="%"
          sublabel={`So với mức chuẩn 3 quái/lượt`}
          glowColor={
            efficiencyRate >= 100 ? 'green' :
            efficiencyRate >= 80 ? 'gold' : 'red'
          }
          highlight={true}
        />
      </div>

      {/* Efficiency gauge */}
      <EfficiencyGauge rate={efficiencyRate} />
    </div>
  );
}
