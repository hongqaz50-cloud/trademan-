/**
 * CalculatorView — Giao diện chính của Trình Tính Toán Hiệu Suất AP & Báo Cáo Pilot.
 *
 * Gồm 2 Tab:
 *   Tab 1 "scan"   → Quét Ảnh Tự Động (Cơ chế 6 ảnh Trước/Sau · AI tự phân loại · Báo cáo Pilot & Bước Tính Toán trực tiếp)
 *   Tab 2 "manual" → Nhập Tay (InputPanel + ResultsPanel thủ công)
 */

import { useState, useCallback } from 'react';
import { useAPCalculator } from '@/hooks/useAPCalculator';
import { InputPanel } from '@/components/InputPanel';
import { ResultsPanel } from '@/components/ResultsPanel';
import { BatchScanner } from '@/components/BatchScanner';

type ActiveTab = 'scan' | 'manual';

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  sublabel,
  id,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  sublabel: string;
  id: string;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm
        transition-all duration-200 border flex-1 sm:flex-none justify-center
        ${active
          ? 'bg-game-accent/15 border-game-accent text-game-accent shadow-glow-cyan'
          : 'bg-black/10 border-game-border text-gray-400 hover:border-gray-500 hover:text-gray-200'
        }
      `}
    >
      <span className="text-lg">{icon}</span>
      <div className="text-left hidden sm:block">
        <div className="leading-none">{label}</div>
        <div className={`text-xs font-normal mt-0.5 ${active ? 'text-game-accent/70' : 'text-gray-600'}`}>
          {sublabel}
        </div>
      </div>
      <div className="sm:hidden leading-none">{label}</div>
    </button>
  );
}

// ─── Empty Results Placeholder ────────────────────────────────────────────────

function EmptyResultsPlaceholder() {
  return (
    <div className="game-card border border-dashed border-game-border/50 flex flex-col items-center justify-center py-16 text-center animate-pulse-slow">
      <div className="text-6xl mb-4 opacity-30">⚔️</div>
      <p className="text-gray-500 font-semibold">Kết quả sẽ hiển thị tại đây</p>
      <p className="text-gray-600 text-sm mt-2">
        Nhập AP và Điểm Danh Dự, sau đó nhấn <span className="text-game-accent">Tính Toán</span>
      </p>
    </div>
  );
}

// ─── Game Rules Card ──────────────────────────────────────────────────────────

function GameRulesCard() {
  return (
    <div className="mt-4 game-card border border-game-border/50">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        📋 Quy Tắc Game
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { icon: '⚡', value: '65', label: 'AP / Run' },
          { icon: '☠️', value: '10', label: 'Honor / Quái' },
          { icon: '🎯', value: '3', label: 'Baseline Quái' },
        ].map((item) => (
          <div key={item.label} className="bg-black/20 rounded-lg p-2">
            <div className="text-lg">{item.icon}</div>
            <div className="font-mono font-bold text-game-accent text-sm">{item.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function CalculatorView() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scan');
  const [scannedPlayerName, setScannedPlayerName] = useState<string>('');

  const {
    formValues,
    errors,
    result,
    hasCalculated,
    handleChange,
    handleSubmit,
    handleReset,
    injectValues,
  } = useAPCalculator();

  /**
   * Called by BatchScanner when AP and Honor are detected.
   * Auto-calculates metrics and keeps user right on the current scan view.
   */
  const handleScanValuesChange = useCallback(
    (apSpent: number, honorGained: number, playerName?: string) => {
      injectValues(apSpent, honorGained);
      if (playerName) setScannedPlayerName(playerName);
    },
    [injectValues]
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">

      {/* ── Tab Switcher (Chỉ 2 Tab Rõ Ràng) ─────────────────────────────── */}
      <div className="flex gap-3 mb-6">
        <TabButton
          id="tab-scan"
          active={activeTab === 'scan'}
          onClick={() => setActiveTab('scan')}
          icon="📷"
          label="Quét Ảnh Tự Động"
          sublabel="6 Ảnh Trước & Sau · AI"
        />
        <TabButton
          id="tab-manual"
          active={activeTab === 'manual'}
          onClick={() => setActiveTab('manual')}
          icon="⌨️"
          label="Nhập Tay"
          sublabel="Nhập AP & Danh Dự"
        />

        {/* Result badge when calculation is ready */}
        {hasCalculated && (
          <div className="ml-auto flex items-center gap-2 text-xs text-game-success bg-game-success/10
            border border-game-success/30 px-3 py-1.5 rounded-full animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-game-success animate-pulse inline-block" />
            Đã tính toán xong
          </div>
        )}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      {activeTab === 'scan' ? (
        <div className="space-y-6">
          {/* Cơ chế quét 6 ảnh Before/After + Báo cáo Pilot Client */}
          <BatchScanner onApplyToCalculator={handleScanValuesChange} />

          {/* ── Bước Tính Toán Hiệu Suất (Results Panel) ── */}
          {result ? (
            <div
              id="scan-calculation-step"
              className="game-card border border-game-border p-5 rounded-2xl bg-black/40 space-y-4 animate-fade-in max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-game-border/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-game-accent animate-pulse" />
                  <h3 className="text-sm font-bold text-white">
                    📊 Bước Tính Toán: Hiệu Suất Cày (Quái / 65 AP)
                  </h3>
                </div>
                <div className="text-xs text-game-accent font-mono font-semibold">
                  {scannedPlayerName ? `Account: ${scannedPlayerName}` : '✓ Tự động tính toán'}
                </div>
              </div>

              <ResultsPanel
                result={result}
                apSpent={parseFloat(formValues.apSpent) || 0}
                honorGained={parseFloat(formValues.honorGained) || 0}
                playerName={scannedPlayerName}
              />
            </div>
          ) : (
            <div className="game-card border border-dashed border-game-border/50 p-6 rounded-2xl text-center max-w-4xl mx-auto">
              <div className="text-3xl mb-2 opacity-40">📊</div>
              <p className="text-xs font-semibold text-gray-400">
                Bước Tính Toán Hiệu Suất Cày (Quái / Run)
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Tải ảnh Đợt Trước & Đợt Sau để hệ thống tự động tính AP đã dùng, điểm danh dự, và hiển thị kết quả tính toán chi tiết tại đây.
              </p>
            </div>
          )}
        </div>
      ) : (
        // Manual input tab
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Form */}
          <div>
            <InputPanel
              formValues={formValues}
              errors={errors}
              hasCalculated={hasCalculated}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onReset={handleReset}
            />
            <GameRulesCard />
          </div>

          {/* Right: Results */}
          <div>
            {result
              ? (
                <ResultsPanel
                  result={result}
                  apSpent={parseFloat(formValues.apSpent) || 0}
                  honorGained={parseFloat(formValues.honorGained) || 0}
                  playerName={scannedPlayerName}
                />
              )
              : <EmptyResultsPlaceholder />
            }
          </div>
        </div>
      )}
    </div>
  );
}
