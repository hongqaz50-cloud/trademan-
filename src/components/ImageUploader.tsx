/**
 * ImageUploader — 4-step wizard for OCR-based AP/Honor scanning.
 *
 * Steps:
 *   1. AP Trước  — AP potion screen before the session
 *   2. AP Sau    — AP potion screen after the session
 *   3. Danh Dự Trước — Honor board before
 *   4. Danh Dự Sau   — Honor board after
 *
 * Final step: Confirmation panel with editable results.
 *
 * This component is a "smart-ish" component: it calls useImageScanner internally,
 * then renders the wizard UI. Receives only onScanComplete callback from parent.
 */

import { useRef, useState } from 'react';
import { useImageScanner, SCAN_STEP_ORDER } from '@/hooks/useImageScanner';
import type { ScanStep, APPotionPair, APScanResult, StepScanState } from '@/types/ocr';

// ─── Constants ────────────────────────────────────────────────────────────────

const KNOWN_AP_COSTS = [50, 100, 500, 1000] as const;

// ─── Step Config ──────────────────────────────────────────────────────────────

interface StepConfig {
  key: ScanStep;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  hint: string;
}

const STEP_CONFIGS: StepConfig[] = [
  {
    key: 'apBefore',
    label: 'AP Trước',
    shortLabel: 'AP Trước',
    icon: '⚡',
    description: 'Ảnh màn hình chọn AP Potion TRƯỚC khi farming',
    hint: 'Chụp màn hình kho AP potion trước khi bắt đầu session.',
  },
  {
    key: 'apAfter',
    label: 'AP Sau',
    shortLabel: 'AP Sau',
    icon: '⚡',
    description: 'Ảnh màn hình chọn AP Potion SAU khi farming',
    hint: 'Chụp màn hình kho AP potion sau khi kết thúc session.',
  },
  {
    key: 'honorBefore',
    label: 'Danh Dự Trước',
    shortLabel: 'DĐ Trước',
    icon: '🏅',
    description: 'Ảnh "Bảng Danh Dự" TRƯỚC khi farming',
    hint: 'Điểm Danh Dự cuối dòng player của bạn.',
  },
  {
    key: 'honorAfter',
    label: 'Danh Dự Sau',
    shortLabel: 'DĐ Sau',
    icon: '🏅',
    description: 'Ảnh "Bảng Danh Dự" SAU khi farming',
    hint: 'Điểm Danh Dự mới sau khi kết thúc session.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Step indicator bar at the top of the wizard */
function StepIndicator({
  currentStep,
  stepStates,
  onGoToStep,
}: {
  currentStep: ScanStep;
  stepStates: Record<ScanStep, StepScanState>;
  onGoToStep: (step: ScanStep) => void;
}) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEP_CONFIGS.map((config, index) => {
        const isDone = stepStates[config.key].isDone;
        const isCurrent = currentStep === config.key;
        const isPast = SCAN_STEP_ORDER.indexOf(config.key) < SCAN_STEP_ORDER.indexOf(currentStep);

        return (
          <div key={config.key} className="flex items-center flex-1">
            {/* Step button */}
            <button
              onClick={() => onGoToStep(config.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-1 justify-center
                ${isCurrent
                  ? 'bg-game-accent/20 border border-game-accent text-game-accent'
                  : isDone
                  ? 'bg-game-success/10 border border-game-success/40 text-game-success cursor-pointer hover:bg-game-success/20'
                  : isPast
                  ? 'bg-black/20 border border-game-border text-gray-500 cursor-pointer hover:border-gray-500'
                  : 'bg-black/10 border border-game-border/50 text-gray-600 cursor-default'
                }
              `}
            >
              {isDone ? (
                <span className="text-game-success">✓</span>
              ) : (
                <span className={isCurrent ? 'text-game-accent' : 'text-gray-600'}>
                  {index + 1}
                </span>
              )}
              <span className="hidden sm:inline">{config.shortLabel}</span>
              <span className="inline sm:hidden">{config.icon}</span>
            </button>

            {/* Connector line */}
            {index < STEP_CONFIGS.length - 1 && (
              <div className={`h-px w-3 flex-shrink-0 mx-0.5 transition-colors duration-300
                ${isDone ? 'bg-game-success/50' : 'bg-game-border/50'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Dropzone area — handles click, drag, paste */
function Dropzone({
  isDraggingOver,
  isScanning,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  onPaste,
  inputRef,
}: {
  isDraggingOver: boolean;
  isScanning: boolean;
  onFileSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !isScanning && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !isScanning && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onPaste={onPaste}
      className={`
        relative flex flex-col items-center justify-center gap-3 min-h-[160px] rounded-xl
        border-2 border-dashed transition-all duration-200 cursor-pointer outline-none
        focus:border-game-accent focus:ring-2 focus:ring-game-accent/20
        ${isDraggingOver
          ? 'border-game-accent bg-game-accent/10 scale-[1.01]'
          : 'border-game-border hover:border-game-accent/60 hover:bg-black/20 bg-black/10'
        }
        ${isScanning ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      <div className="text-4xl opacity-60">📸</div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-300">
          Kéo thả ảnh vào đây
        </p>
        <p className="text-xs text-gray-500 mt-1">
          hoặc <span className="text-game-accent">click để chọn file</span>
          {' '}· <kbd className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded border border-game-border">Ctrl+V</kbd> để dán
        </p>
      </div>
      <p className="text-xs text-gray-600">PNG, JPG, WebP · Tối đa 10MB</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Scanning overlay on top of image preview */
function ScanningOverlay({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 gap-2 bg-black/60 rounded-xl">
      <div className="text-sm font-semibold text-game-accent">
        🔍 Đang nhận diện... {progress}%
      </div>
      <div className="w-4/5 h-2 bg-black/50 rounded-full overflow-hidden border border-game-border">
        <div
          className="h-full bg-gradient-to-r from-game-accent to-game-purple rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/** Collapsible raw OCR text for debugging misreads */
function OCRDebugPanel({ rawText }: { rawText: string }) {
  const [open, setOpen] = useState(false);
  // Early return must come AFTER all hooks (React rules of hooks)
  if (!rawText.trim()) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors"
      >
        <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        OCR text thô (debug)
      </button>
      {open && (
        <pre className="mt-1.5 p-2 bg-black/40 border border-game-border/50 rounded-lg text-xs
          text-gray-500 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
          {rawText || '(trống)'}
        </pre>
      )}
    </div>
  );
}

/**
 * Editable AP potion quantity table.
 * Pre-fills from OCR results but always shows all 4 potion types.
 * User can correct any quantity; total updates live.
 * Calls onChange(newResult) so parent can update aggregated state.
 */
function APQuantityEditor({
  initialPotions,
  onChange,
}: {
  initialPotions: APPotionPair[];
  onChange: (result: APScanResult) => void;
}) {
  const [quantities, setQuantities] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = { 50: '', 100: '', 500: '', 1000: '' };
    initialPotions.forEach((p) => {
      if (KNOWN_AP_COSTS.includes(p.cost as typeof KNOWN_AP_COSTS[number])) {
        init[p.cost] = p.quantity > 0 ? String(p.quantity) : '';
      }
    });
    return init;
  });

  const parsePotions = (qtys: Record<number, string>) =>
    KNOWN_AP_COSTS.map((cost) => ({
      cost,
      quantity: parseInt(qtys[cost] || '0', 10) || 0,
    }));

  const currentPotions = parsePotions(quantities);
  const total = currentPotions.reduce((s, p) => s + p.cost * p.quantity, 0);

  const handleChange = (cost: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    const next = { ...quantities, [cost]: cleaned };
    setQuantities(next);
    const potions = parsePotions(next);
    onChange({ potions, totalAP: potions.reduce((s, p) => s + p.cost * p.quantity, 0) });
  };

  const hasAnyOCR = currentPotions.some((p) => p.quantity > 0);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          Số lượng bình:
        </p>
        {!hasAnyOCR && (
          <span className="text-xs text-yellow-400 animate-pulse">
            ✏️ OCR không đọc được · nhập tay
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {KNOWN_AP_COSTS.map((cost) => {
          const qty = parseInt(quantities[cost] || '0', 10) || 0;
          const subtotal = cost * qty;
          return (
            <div
              key={cost}
              className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-game-border/30"
            >
              <span
                className={`text-xs font-mono font-bold w-16 shrink-0
                  ${cost === 1000 ? 'text-game-purple'
                    : cost === 500  ? 'text-yellow-400'
                    : cost === 100  ? 'text-game-accent'
                    : 'text-gray-300'}`}
              >
                {cost.toLocaleString()} AP
              </span>

              <span className="text-gray-600 text-xs shrink-0">×</span>

              <input
                type="text"
                inputMode="numeric"
                value={quantities[cost]}
                onChange={(e) => handleChange(cost, e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 bg-black/40 border border-game-border rounded-md
                  px-2 py-1 text-xs font-mono text-white text-right
                  focus:outline-none focus:border-game-accent focus:ring-1 focus:ring-game-accent/30
                  placeholder:text-gray-700 transition-colors"
              />

              <span className="text-gray-600 text-xs shrink-0">=</span>

              <span className="text-game-gold font-mono font-semibold text-xs w-20 shrink-0 text-right">
                {subtotal > 0 ? subtotal.toLocaleString() : '—'}
              </span>
            </div>
          );
        })}

        {/* Total */}
        <div
          className={`flex items-center justify-between font-mono font-bold
            px-3 py-2 rounded-lg border transition-colors
            ${total > 0
              ? 'bg-game-accent/10 border-game-accent/40'
              : 'bg-black/20 border-game-border/40'
            }`}
        >
          <span className="text-gray-300 text-sm">Tổng AP</span>
          <span className={`text-sm ${total > 0 ? 'text-game-accent' : 'text-gray-600'}`}>
            {total > 0 ? total.toLocaleString() : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Image preview with optional scanning overlay */
function ImagePreview({
  previewUrl,
  isScanning,
  scanProgress,
  isDone,
  onClear,
  children,
}: {
  previewUrl: string;
  isScanning: boolean;
  scanProgress: number;
  isDone: boolean;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Image + overlay */}
      <div className="relative rounded-xl overflow-hidden border border-game-border bg-black/20">
        <img
          src={previewUrl}
          alt="Ảnh đã chọn"
          className={`w-full max-h-48 object-contain transition-opacity duration-300 ${
            isScanning ? 'opacity-40' : 'opacity-100'
          }`}
        />
        {isScanning && <ScanningOverlay progress={scanProgress} />}
        {isDone && (
          <div className="absolute top-2 right-2 flex gap-1">
            <span className="bg-game-success/90 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
              <span>✓</span> Xong
            </span>
          </div>
        )}
        {/* Clear button */}
        {!isScanning && (
          <button
            onClick={onClear}
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 hover:bg-game-danger/80
              text-white text-xs flex items-center justify-center transition-colors border border-game-border"
            title="Xóa ảnh này"
          >
            ✕
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** Confirmation panel shown when all 4 steps are done */
function ConfirmationPanel({
  aggregated,
  onConfirm,
  onReset,
}: {
  aggregated: {
    apBefore: number | null;
    apAfter: number | null;
    apSpent: number | null;
    honorBefore: number | null;
    honorAfter: number | null;
    honorGained: number | null;
  };
  onConfirm: (apSpent: number, honorGained: number) => void;
  onReset: () => void;
}) {
  const [editAP, setEditAP] = useState(String(aggregated.apSpent ?? ''));
  const [editHonor, setEditHonor] = useState(String(aggregated.honorGained ?? ''));

  const handleConfirm = () => {
    const ap = parseInt(editAP.replace(/\D/g, ''), 10);
    const honor = parseInt(editHonor.replace(/\D/g, ''), 10);
    if (isNaN(ap) || isNaN(honor)) return;
    onConfirm(ap, honor);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="text-center">
        <div className="text-3xl mb-2">🎯</div>
        <h3 className="text-base font-bold text-white">Xác nhận kết quả</h3>
        <p className="text-xs text-gray-500 mt-1">
          Kiểm tra và chỉnh sửa nếu OCR nhận diện nhầm
        </p>
      </div>

      {/* Calculation breakdown */}
      <div className="bg-black/20 border border-game-border rounded-xl p-4 space-y-3 text-xs font-mono">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-gray-500 mb-1">⚡ AP Trước</p>
            <p className="text-white font-bold">{aggregated.apBefore?.toLocaleString() ?? '—'}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-gray-500 mb-1">⚡ AP Sau</p>
            <p className="text-white font-bold">{aggregated.apAfter?.toLocaleString() ?? '—'}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-gray-500 mb-1">🏅 DĐ Trước</p>
            <p className="text-white font-bold">{aggregated.honorBefore?.toLocaleString() ?? '—'}</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <p className="text-gray-500 mb-1">🏅 DĐ Sau</p>
            <p className="text-white font-bold">{aggregated.honorAfter?.toLocaleString() ?? '—'}</p>
          </div>
        </div>

        <div className="border-t border-game-border/50 pt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-400 mb-1.5">⚡ AP Đã Dùng</label>
            <input
              type="text"
              value={editAP}
              onChange={(e) => setEditAP(e.target.value.replace(/[^0-9]/g, ''))}
              className="game-input text-sm text-game-accent font-bold"
              placeholder="0"
            />
            <p className="text-gray-600 text-xs mt-1">= AP Trước − AP Sau</p>
          </div>
          <div>
            <label className="block text-gray-400 mb-1.5">🏅 Danh Dự Nhận</label>
            <input
              type="text"
              value={editHonor}
              onChange={(e) => setEditHonor(e.target.value.replace(/[^0-9]/g, ''))}
              className="game-input text-sm text-game-gold font-bold"
              placeholder="0"
            />
            <p className="text-gray-600 text-xs mt-1">= DĐ Sau − DĐ Trước</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={!editAP || !editHonor}
          className="game-btn-primary flex-1 text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🚀</span>
          <span>Áp dụng & Tính Toán</span>
        </button>
        <button onClick={onReset} className="game-btn-secondary px-4">
          🔄
        </button>
      </div>
    </div>
  );
}

// ─── Main ImageUploader Component ─────────────────────────────────────────────

interface ImageUploaderProps {
  onScanComplete: (apSpent: number, honorGained: number) => void;
}

export function ImageUploader({ onScanComplete }: ImageUploaderProps) {
  const {
    currentStep,
    stepStates,
    aggregated,
    isDraggingOver,
    allStepsDone,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handlePaste,
    handleClearStep,
    goToStep,
    handleConfirm,
    overrideAPResult,
    resetScanner,
  } = useImageScanner(onScanComplete);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentConfig = STEP_CONFIGS.find((c) => c.key === currentStep)!;
  const currentState = stepStates[currentStep];

  const goNext = () => {
    const idx = SCAN_STEP_ORDER.indexOf(currentStep);
    if (idx < SCAN_STEP_ORDER.length - 1) {
      goToStep(SCAN_STEP_ORDER[idx + 1]);
    }
  };

  const goPrev = () => {
    const idx = SCAN_STEP_ORDER.indexOf(currentStep);
    if (idx > 0) goToStep(SCAN_STEP_ORDER[idx - 1]);
  };

  const isFirstStep = currentStep === SCAN_STEP_ORDER[0];
  const isLastStep = currentStep === SCAN_STEP_ORDER[SCAN_STEP_ORDER.length - 1];

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="game-card border border-game-border flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📷</span> Quét Ảnh Tự Động
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">4 bước · AP trước/sau · Danh Dự trước/sau</p>
          </div>
          {(allStepsDone || Object.values(stepStates).some((s) => s.isDone)) && (
            <button
              onClick={resetScanner}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              🔄 Bắt đầu lại
            </button>
          )}
        </div>

        {/* Step indicator */}
        <StepIndicator
          currentStep={currentStep}
          stepStates={stepStates}
          onGoToStep={goToStep}
        />

        {/* Show confirmation when all done */}
        {allStepsDone ? (
          <ConfirmationPanel
            aggregated={aggregated}
            onConfirm={handleConfirm}
            onReset={resetScanner}
          />
        ) : (
          <>
            {/* Current step content */}
            <div className="flex flex-col gap-3" onPaste={handlePaste}>
              {/* Step description */}
              <div className="flex items-start gap-2">
                <span className="text-xl">{currentConfig.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Bước {SCAN_STEP_ORDER.indexOf(currentStep) + 1}/4 · {currentConfig.label}
                  </p>
                  <p className="text-xs text-gray-500">{currentConfig.description}</p>
                </div>
              </div>

              {/* Dropzone or Preview */}
              {currentState.previewUrl ? (
                <ImagePreview
                  previewUrl={currentState.previewUrl}
                  isScanning={currentState.isScanning}
                  scanProgress={currentState.scanProgress}
                  isDone={currentState.isDone}
                  onClear={() => handleClearStep(currentStep)}
                >
                  {/* AP steps: always show editable quantity table */}
                  {currentState.isDone && currentState.apResult && (
                    <APQuantityEditor
                      initialPotions={currentState.apResult.potions}
                      onChange={(result) =>
                        overrideAPResult(currentStep as 'apBefore' | 'apAfter', result)
                      }
                    />
                  )}
                  {currentState.isDone && currentState.honorResult && (
                    <div className="flex items-center justify-between bg-black/20 border border-game-border/50 rounded-lg px-4 py-3 mt-2">
                      <div>
                        <span className="text-xs text-gray-400">Điểm Danh Dự nhận diện</span>
                        {currentState.honorResult.confidence !== 'high' && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-semibold
                            ${currentState.honorResult.confidence === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-game-danger/20 text-game-danger'
                            }`}>
                            {currentState.honorResult.confidence === 'medium' ? '⚠ medium' : '⚠ low'}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-game-gold text-lg">
                        {currentState.honorResult.honorValue.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {/* Debug: raw OCR text */}
                  {currentState.isDone && currentState.rawOCRText && (
                    <OCRDebugPanel rawText={currentState.rawOCRText} />
                  )}
                </ImagePreview>
              ) : (
                <Dropzone
                  isDraggingOver={isDraggingOver}
                  isScanning={currentState.isScanning}
                  onFileSelect={handleFileSelect}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onPaste={handlePaste}
                  inputRef={fileInputRef}
                />
              )}

              {/* Error message */}
              {currentState.scanError && (
                <p className="text-xs text-game-danger flex items-center gap-1 animate-fade-in">
                  <span>⚠️</span> {currentState.scanError}
                </p>
              )}

              {/* Hint */}
              <p className="text-xs text-gray-600 italic">
                💡 {currentConfig.hint}
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-1 border-t border-game-border/40">
              <button
                onClick={goPrev}
                disabled={isFirstStep}
                className="game-btn-secondary text-sm px-4 py-2 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                ← Trước
              </button>

              {/* Progress dots */}
              <div className="flex gap-1.5">
                {SCAN_STEP_ORDER.map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      step === currentStep
                        ? 'bg-game-accent scale-125'
                        : stepStates[step].isDone
                        ? 'bg-game-success'
                        : 'bg-game-border'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={goNext}
                disabled={isLastStep || !currentState.isDone}
                className={`text-sm px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-1
                  ${currentState.isDone && !isLastStep
                    ? 'game-btn-primary text-white'
                    : 'game-btn-secondary opacity-40 cursor-not-allowed'
                  }`}
              >
                Tiếp →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
