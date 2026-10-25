/**
 * ResultsPanel — Displays the full calculation output.
 * Shows 4 MetricCards in a grid + the EfficiencyGauge.
 * Receives a CalculationResult prop; knows nothing about how it was calculated.
 */

import { useState } from 'react';
import type { CalculationResult } from '@/types/calculator';
import { MetricCard } from '@/components/ui/MetricCard';
import { EfficiencyGauge } from '@/components/EfficiencyGauge';
import { PilotReportModal } from '@/components/PilotReportModal';
import { formatNumber } from '@/utils/apCalculator';

interface ResultsPanelProps {
  result: CalculationResult;
  apSpent?: number;
  honorGained?: number;
  playerName?: string;
}

export function ResultsPanel({ result, apSpent, honorGained, playerName }: ResultsPanelProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const { totalMonsters, totalRuns, monstersPerRun, efficiencyRate } = result;

  const effectiveApSpent = apSpent ?? Math.round(totalRuns * 65);
  const effectiveHonorGained = honorGained ?? Math.round(totalMonsters * 10);

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

      {/* Pilot Report Export Card */}
      <div className="p-4 rounded-xl border border-game-accent/40 bg-gradient-to-r from-game-accent/15 via-black/30 to-game-purple/15 flex items-center justify-between shadow-glow-cyan">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-game-accent/20 border border-game-accent/50 flex items-center justify-center text-xl">
            📋
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Báo Cáo Pilot (Cho Khách)
              <span className="text-[10px] bg-game-accent/20 text-game-accent px-1.5 py-0.5 rounded font-mono">
                1-Click Copy
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Định dạng chuẩn: Account, Pilot, Time, AP, Honor, Speedups
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-game-accent text-black hover:brightness-110 shadow-glow-cyan transition-all flex items-center gap-1.5 shrink-0"
        >
          <span>📋</span>
          <span>Xuất Báo Cáo</span>
        </button>
      </div>

      {/* Pilot Report Modal */}
      <PilotReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        apSpent={effectiveApSpent}
        honorGained={effectiveHonorGained}
        scannedAccount={playerName}
      />
    </div>
  );
}
