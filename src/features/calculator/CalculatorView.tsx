/**
 * CalculatorView — Page-level layout for the AP Calculator feature.
 *
 * Manages the active tab state:
 *   Tab 1 "manual" → InputPanel + ResultsPanel (existing flow)
 *   Tab 2 "scan"   → ImageUploader 4-step OCR wizard
 *
 * On successful scan, injects values into useAPCalculator,
 * auto-calculates, then switches back to the manual tab to show results.
 */

import { useState, useCallback } from 'react';
import { useAPCalculator } from '@/hooks/useAPCalculator';
import { InputPanel } from '@/components/InputPanel';
import { ResultsPanel } from '@/components/ResultsPanel';
import { ImageUploader } from '@/components/ImageUploader';

type ActiveTab = 'manual' | 'scan';

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

function EmptyResultsPlaceholder({ fromScan }: { fromScan?: boolean }) {
  return (
    <div className="game-card border border-dashed border-game-border/50 flex flex-col items-center justify-center py-16 text-center animate-pulse-slow">
      <div className="text-6xl mb-4 opacity-30">{fromScan ? '📷' : '⚔️'}</div>
      <p className="text-gray-500 font-semibold">Kết quả sẽ hiển thị tại đây</p>
      <p className="text-gray-600 text-sm mt-2">
        {fromScan
          ? 'Hoàn thành 4 bước quét ảnh để xem kết quả'
          : <>Nhập AP và Điểm Danh Dự, sau đó nhấn <span className="text-game-accent">Tính Toán</span></>
        }
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('manual');

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
   * Called by ImageUploader when user confirms scan results.
   * Injects values into the calculator and switches to manual tab to show results.
   */
  const handleScanComplete = useCallback(
    (apSpent: number, honorGained: number) => {
      injectValues(apSpent, honorGained);
      setActiveTab('manual');
    },
    [injectValues]
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">

      {/* ── Tab Switcher ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-6">
        <TabButton
          id="tab-manual"
          active={activeTab === 'manual'}
          onClick={() => setActiveTab('manual')}
          icon="⌨️"
          label="Nhập Tay"
          sublabel="Nhập AP & Danh Dự"
        />
        <TabButton
          id="tab-scan"
          active={activeTab === 'scan'}
          onClick={() => setActiveTab('scan')}
          icon="📷"
          label="Quét Ảnh"
          sublabel="OCR tự động · 4 bước"
        />

        {/* Result badge when scan has been applied */}
        {hasCalculated && activeTab === 'manual' && (
          <div className="ml-auto flex items-center gap-2 text-xs text-game-success bg-game-success/10
            border border-game-success/30 px-3 py-1.5 rounded-full animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-game-success animate-pulse inline-block" />
            Đã tính toán
          </div>
        )}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      {activeTab === 'manual' ? (
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
              ? <ResultsPanel result={result} />
              : <EmptyResultsPlaceholder />
            }
          </div>
        </div>
      ) : (
        // Scan tab
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Image uploader wizard */}
          <div className="lg:col-span-1">
            <ImageUploader onScanComplete={handleScanComplete} />
          </div>

          {/* Right: Results (shown live if previous calc exists) */}
          <div>
            {result
              ? <ResultsPanel result={result} />
              : <EmptyResultsPlaceholder fromScan />
            }
          </div>
        </div>
      )}
    </div>
  );
}
