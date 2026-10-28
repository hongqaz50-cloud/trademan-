/**
 * BatchScanner.tsx — Quét ảnh Đợt Trước & Đợt Sau chia theo 3 khung rõ ràng:
 * 1. 🎖️ Bảng Danh Dự (Honor Board)
 * 2. 🧪 Kho Bình AP (AP Potions)
 * 3. ⚡ Kho Tăng Tốc (Speedups)
 *
 * Tính năng nâng cao:
 * - Hỗ trợ nhấn Ctrl + V (hoặc nút Dán) trực tiếp vào ĐỢT 1, ĐỢT 2 hoặc từng khung cụ thể.
 * - Tự động tính toán số giờ (Hours) khi nhập Time (ví dụ: "25/10, 0:30 - 13:24" -> "12,9").
 * - Gemini AI trích xuất và tính toán ra báo cáo Pilot chuẩn client.
 */

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  scanSmartScreenshotWithAI,
  scanHonorWithAI,
  scanAPWithAI,
  scanSpeedupWithAI,
  scanBatchScreenshotsWithAI,
  formatSpeedupDelta,
  isAIEnabled,
  getStoredApiKey,
  getStoredModel,
} from '@/services/aiVisionService';
import type { HonorScanResult, APScanResult, SpeedupScanResult, SmartScanResult } from '@/types/ocr';
import { AISettingsModal } from '@/components/AISettingsModal';

// ─── Time Range to Hours Calculator ──────────────────────────────────────────

/**
 * Parses a time range string like "25/10, 0:30 - 13:24" or "0:30 - 15:24"
 * and returns the calculated hours formatted with a comma (e.g. "12,9", "14,9").
 */
export function calculateHoursFromTimeRange(timeStr: string): string | null {
  if (!timeStr || !timeStr.includes('-')) return null;

  const parts = timeStr.split('-');
  if (parts.length !== 2) return null;

  const startStr = parts[0].trim();
  const endStr = parts[1].trim();

  // Match optional date: DD/MM or DD-MM or DD.MM
  // Match time: HH:MM or H:MM or HH.MM or HHhMM
  const parsePart = (str: string) => {
    const dateMatch = str.match(/(\d{1,2})[\/\.-](\d{1,2})/);
    const timeMatch = str.match(/(\d{1,2})[:\.hH](\d{2})/);
    if (!timeMatch) return null;

    return {
      day: dateMatch ? parseInt(dateMatch[1], 10) : null,
      month: dateMatch ? parseInt(dateMatch[2], 10) : null,
      hour: parseInt(timeMatch[1], 10),
      minute: parseInt(timeMatch[2], 10),
    };
  };

  const start = parsePart(startStr);
  const end = parsePart(endStr);

  if (!start || !end) return null;

  let totalMinutes = 0;

  if (
    start.day !== null &&
    end.day !== null &&
    (start.day !== end.day || (start.month !== null && end.month !== null && start.month !== end.month))
  ) {
    const now = new Date();
    const year = now.getFullYear();
    const d1 = new Date(year, (start.month || 1) - 1, start.day, start.hour, start.minute);
    const d2 = new Date(year, (end.month || 1) - 1, end.day, end.hour, end.minute);
    totalMinutes = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60));
  } else {
    const startMins = start.hour * 60 + start.minute;
    let endMins = end.hour * 60 + end.minute;
    if (endMins < startMins) {
      // Overnight (crossed 00:00 midnight)
      endMins += 24 * 60;
    }
    totalMinutes = endMins - startMins;
  }

  if (totalMinutes <= 0) return null;

  const hoursFloat = totalMinutes / 60;
  const rounded = Math.round(hoursFloat * 10) / 10;
  return rounded.toString().replace('.', ',');
}

// ─── Slot Types ───────────────────────────────────────────────────────────────

interface SlotState<T> {
  file: File | null;
  preview: string | null;
  isScanning: boolean;
  result: T | null;
  error: string | null;
}

const initialSlotState = <T,>(): SlotState<T> => ({
  file: null,
  preview: null,
  isScanning: false,
  result: null,
  error: null,
});

interface BatchSideState {
  honor: SlotState<HonorScanResult>;
  ap: SlotState<APScanResult>;
  speedup: SlotState<SpeedupScanResult>;
  isBatchScanning: boolean;
  batchError: string | null;
}

const initialSideState = (): BatchSideState => ({
  honor: initialSlotState<HonorScanResult>(),
  ap: initialSlotState<APScanResult>(),
  speedup: initialSlotState<SpeedupScanResult>(),
  isBatchScanning: false,
  batchError: null,
});

interface BatchScannerProps {
  onApplyToCalculator: (apSpent: number, honorGained: number, playerName?: string) => void;
}

// ─── Slot Item Subcomponent ───────────────────────────────────────────────────

function ImageSlotItem<T>({
  icon,
  title,
  hint,
  state,
  isActive,
  renderResult,
  onFileSelect,
  onRemove,
  onClick,
  onPasteClick,
}: {
  icon: string;
  title: string;
  hint: string;
  state: SlotState<T>;
  isActive?: boolean;
  renderResult: (result: T) => { primary: string; secondary?: string };
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  onClick?: () => void;
  onPasteClick?: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handlePasteOnSlot = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          e.stopPropagation();
          onFileSelect(new File([blob], `paste_${Date.now()}.png`, { type: blob.type }));
          return;
        }
      }
    }
  };

  // 1. Scanning State
  if (state.isScanning) {
    return (
      <div className="p-3 rounded-xl border border-game-accent/60 bg-game-accent/10 flex items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-game-accent/20 border border-game-accent/40 flex items-center justify-center text-xl animate-bounce">
            🤖
          </div>
          <div>
            <div className="text-xs font-bold text-game-accent flex items-center gap-1.5">
              <span>{icon}</span> {title}
            </div>
            <p className="text-[11px] text-gray-300 mt-0.5">Gemini AI đang phân tích...</p>
          </div>
        </div>
        <div className="text-xs font-mono text-game-accent animate-spin">⏳</div>
      </div>
    );
  }

  // 2. Uploaded & Result State
  if (state.preview && state.result) {
    const { primary, secondary } = renderResult(state.result);
    return (
      <div
        onClick={onClick}
        onPaste={handlePasteOnSlot}
        tabIndex={0}
        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 outline-none ${
          isActive
            ? 'border-game-accent bg-black/60 shadow-glow-cyan'
            : 'border-game-success/40 bg-black/40 hover:bg-black/50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={state.preview}
            alt={title}
            className="w-12 h-12 object-cover rounded-lg border border-game-border shadow-sm shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            title={title}
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-game-success flex items-center gap-1.5 truncate">
              <span>{icon}</span> {title}
              <span className="text-[10px] bg-game-success/20 text-game-success px-1.5 py-0.2 rounded font-mono">
                ✓ Xong
              </span>
              {isActive && (
                <span className="text-[10px] bg-game-accent/20 text-game-accent px-1 rounded font-mono">
                  Ctrl+V
                </span>
              )}
            </div>
            <div className="text-xs font-mono font-bold text-white truncate mt-0.5">
              {primary}
            </div>
            {secondary && (
              <div className="text-[10px] text-gray-400 font-mono truncate">
                {secondary}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
              fileInputRef.current?.click();
            }}
            className="px-2 py-1 rounded text-[11px] font-semibold text-gray-300 hover:text-white bg-black/40 border border-game-border hover:border-game-accent transition-colors"
            title="Đổi ảnh khác"
          >
            Đổi
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-7 h-7 rounded text-xs text-gray-400 hover:text-red-400 bg-black/40 border border-game-border hover:border-red-500/40 flex items-center justify-center transition-colors"
            title="Xóa ảnh này"
          >
            ✕
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    );
  }

  // 3. Error State
  if (state.error) {
    return (
      <div
        onClick={onClick}
        onPaste={handlePasteOnSlot}
        tabIndex={0}
        className="p-2.5 rounded-xl border border-red-500/50 bg-red-950/20 flex items-center justify-between gap-2 outline-none"
      >
        <div className="min-w-0">
          <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
            <span>{icon}</span> {title}
          </div>
          <p className="text-[11px] text-red-300 font-mono truncate">{state.error}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
              fileInputRef.current?.click();
            }}
            className="px-2 py-1 rounded text-[11px] font-semibold text-red-300 bg-red-900/30 border border-red-500/40 hover:bg-red-900/50"
          >
            Thử lại
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-7 h-7 rounded text-xs text-gray-400 hover:text-white bg-black/40 border border-game-border"
          >
            ✕
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    );
  }

  // 4. Empty / Dropzone State
  return (
    <div
      onClick={onClick}
      onPaste={handlePasteOnSlot}
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`
        p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center justify-between gap-3 outline-none
        ${isDragOver
          ? 'bg-game-accent/15 border-game-accent shadow-glow-cyan'
          : isActive
          ? 'border-game-accent/80 bg-black/35 shadow-glow-cyan'
          : 'bg-black/20 border-game-border/70 hover:border-game-accent/60 hover:bg-black/30'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-black/40 border border-game-border/60 flex items-center justify-center text-lg">
          {icon}
        </div>
        <div>
          <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
            {title}
            {isActive && (
              <span className="text-[10px] text-game-accent bg-game-accent/15 px-1.5 py-0.2 rounded font-mono">
                Sẵn sàng Ctrl+V
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {hint}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        {onPasteClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
              onPasteClick();
            }}
            className="text-[11px] font-semibold text-gray-300 bg-black/40 hover:text-game-accent border border-game-border px-2 py-1 rounded-lg transition-colors"
            title="Dán từ Clipboard (Ctrl+V)"
          >
            📋 Dán
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
            fileInputRef.current?.click();
          }}
          className="text-[11px] font-semibold text-game-accent bg-game-accent/10 border border-game-accent/20 px-2.5 py-1 rounded-lg hover:bg-game-accent/20 transition-colors"
        >
          + Chọn ảnh
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}

// ─── Main BatchScanner Component ──────────────────────────────────────────────

export function BatchScanner({ onApplyToCalculator }: BatchScannerProps) {
  const [beforeState, setBeforeState] = useState<BatchSideState>(initialSideState);
  const [afterState, setAfterState] = useState<BatchSideState>(initialSideState);

  // Active side & slot for Ctrl+V targeting
  const [activeSide, setActiveSide] = useState<'before' | 'after'>('before');
  const [activeSlot, setActiveSlot] = useState<'honor' | 'ap' | 'speedup' | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Time & Hours handling with auto-calculation
  const defaultTime = useMemo(() => {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${d}/${m}, 0:30 - 13:24`;
  }, []);

  const [time, setTime] = useState(defaultTime);
  const [hours, setHours] = useState(() => {
    return calculateHoursFromTimeRange(defaultTime) || '12,9';
  });

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    const calculatedHours = calculateHoursFromTimeRange(newTime);
    if (calculatedHours) {
      setHours(calculatedHours);
    }
  };

  // Report fields
  const [pilot, setPilot] = useState(() => {
    try {
      const dUser = localStorage.getItem('trademan_discord_user');
      if (dUser) {
        const parsed = JSON.parse(dUser);
        if (parsed.global_name || parsed.username) {
          return parsed.global_name || parsed.username;
        }
      }
    } catch {
      // Ignore
    }
    return localStorage.getItem('trademan_pilot_name') || 'Hunter';
  });
  const [accountOverride, setAccountOverride] = useState<string>('');
  const [note, setNote] = useState(() => localStorage.getItem('trademan_pilot_note') || '5 marches');
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync pilot name if user logs in with Discord
  useEffect(() => {
    const handleStorage = () => {
      try {
        const dUser = localStorage.getItem('trademan_discord_user');
        if (dUser) {
          const parsed = JSON.parse(dUser);
          if (parsed.global_name || parsed.username) {
            setPilot(parsed.global_name || parsed.username);
          }
        }
      } catch {
        // Ignore
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const beforeBatchInputRef = useRef<HTMLInputElement>(null);
  const afterBatchInputRef = useRef<HTMLInputElement>(null);

  const aiActive = isAIEnabled() && Boolean(getStoredApiKey());
  const currentModel = getStoredModel();

  // ── Single Slot Smart Upload (Auto-Classifies Screenshot Type) ─────────────

  const handleSmartSingleUpload = useCallback(
    async (
      side: 'before' | 'after',
      preferredSlot: 'honor' | 'ap' | 'speedup' | null,
      file: File
    ) => {
      const previewUrl = URL.createObjectURL(file);
      const setSideState = side === 'before' ? setBeforeState : setAfterState;

      // Choose which slot shows scanning indicator
      const initialSlot: 'honor' | 'ap' | 'speedup' = preferredSlot || 'honor';

      setSideState((prev) => ({
        ...prev,
        [initialSlot]: {
          ...prev[initialSlot],
          isScanning: true,
          error: null,
        },
      }));

      try {
        let smartRes: SmartScanResult;

        if (preferredSlot === 'honor') {
          const res = await scanHonorWithAI(file);
          smartRes = { type: 'honor', result: res };
        } else if (preferredSlot === 'ap') {
          const res = await scanAPWithAI(file);
          smartRes = { type: 'ap', result: res };
        } else if (preferredSlot === 'speedup') {
          const res = await scanSpeedupWithAI(file);
          smartRes = { type: 'speedup', result: res };
        } else {
          smartRes = await scanSmartScreenshotWithAI(file);
        }

        const actualSlot = smartRes.type; // 'honor' | 'ap' | 'speedup'

        const slotNames: Record<'honor' | 'ap' | 'speedup', string> = {
          honor: 'Bảng Danh Dự',
          ap: 'Kho Bình AP',
          speedup: 'Kho Tăng Tốc',
        };
        const sideNames: Record<'before' | 'after', string> = {
          before: 'Đợt 1 (Trước)',
          after: 'Đợt 2 (Sau)',
        };

        setSideState((prev) => {
          const next = { ...prev };

          // If the image belongs to a different slot than initialSlot, clear initialSlot if it was empty
          if (initialSlot !== actualSlot && !prev[initialSlot].result) {
            next[initialSlot] = initialSlotState();
          }

          if (actualSlot === 'honor') {
            next.honor = {
              file,
              preview: previewUrl,
              isScanning: false,
              result: smartRes.result,
              error: null,
            };
          } else if (actualSlot === 'ap') {
            next.ap = {
              file,
              preview: previewUrl,
              isScanning: false,
              result: smartRes.result,
              error: null,
            };
          } else if (actualSlot === 'speedup') {
            next.speedup = {
              file,
              preview: previewUrl,
              isScanning: false,
              result: smartRes.result,
              error: null,
            };
          }

          return next;
        });

        showToast(`✓ Đã tự động nhận diện và xếp vào [${slotNames[actualSlot]}] - ${sideNames[side]}`);

        // Automatically point to next slot or side
        if (actualSlot === 'honor') setActiveSlot('ap');
        else if (actualSlot === 'ap') setActiveSlot('speedup');
        else {
          setActiveSlot(null);
          if (side === 'before') setActiveSide('after');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setSideState((prev) => ({
          ...prev,
          [initialSlot]: {
            ...prev[initialSlot],
            isScanning: false,
            error: msg,
          },
        }));
      }
    },
    [showToast]
  );

  const handleRemoveSlot = useCallback(
    (side: 'before' | 'after', slot: 'honor' | 'ap' | 'speedup') => {
      const setSideState = side === 'before' ? setBeforeState : setAfterState;
      setSideState((prev) => ({
        ...prev,
        [slot]: initialSlotState(),
      }));
    },
    []
  );

  // ── Multi-File / Batch Upload Handlers ──────────────────────────────────────

  const handleBatchUpload = async (side: 'before' | 'after', fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 3);
    if (files.length === 0) return;

    const setSideState = side === 'before' ? setBeforeState : setAfterState;

    setSideState((prev) => ({
      ...prev,
      isBatchScanning: true,
      batchError: null,
      honor: { ...prev.honor, isScanning: true },
      ap: { ...prev.ap, isScanning: true },
      speedup: { ...prev.speedup, isScanning: true },
    }));

    try {
      const batchResult = await scanBatchScreenshotsWithAI(files);

      // Determine accurate file mapping based on AI classification
      let hIdx = typeof batchResult.honorImageIndex === 'number' ? batchResult.honorImageIndex : 0;
      let aIdx = typeof batchResult.apImageIndex === 'number' ? batchResult.apImageIndex : 1;
      let sIdx = typeof batchResult.speedupImageIndex === 'number' ? batchResult.speedupImageIndex : 2;

      // Boundary safety
      if (hIdx < 0 || hIdx >= files.length) hIdx = 0;
      if (aIdx < 0 || aIdx >= files.length) aIdx = files.length > 1 ? 1 : 0;
      if (sIdx < 0 || sIdx >= files.length) sIdx = files.length > 2 ? 2 : files.length - 1;

      // If 3 files are passed, resolve any index collision
      if (files.length === 3) {
        const used = new Set<number>();
        used.add(hIdx);
        if (used.has(aIdx)) {
          const unused = [0, 1, 2].find((i) => !used.has(i)) ?? 1;
          aIdx = unused;
        }
        used.add(aIdx);
        if (used.has(sIdx)) {
          const unused = [0, 1, 2].find((i) => !used.has(i)) ?? 2;
          sIdx = unused;
        }
      }

      const honorFile = files[hIdx] || null;
      const apFile = files[aIdx] || null;
      const speedupFile = files[sIdx] || null;

      const honorPreview = honorFile ? URL.createObjectURL(honorFile) : null;
      const apPreview = apFile ? URL.createObjectURL(apFile) : null;
      const speedupPreview = speedupFile ? URL.createObjectURL(speedupFile) : null;

      setSideState((prev) => ({
        ...prev,
        isBatchScanning: false,
        honor: {
          file: honorFile,
          preview: honorPreview,
          isScanning: false,
          result: batchResult.honor,
          error: null,
        },
        ap: {
          file: apFile,
          preview: apPreview,
          isScanning: false,
          result: batchResult.ap,
          error: null,
        },
        speedup: {
          file: speedupFile,
          preview: speedupPreview,
          isScanning: false,
          result: batchResult.speedup,
          error: null,
        },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSideState((prev) => ({
        ...prev,
        isBatchScanning: false,
        batchError: msg,
        honor: { ...prev.honor, isScanning: false, error: msg },
        ap: { ...prev.ap, isScanning: false, error: msg },
        speedup: { ...prev.speedup, isScanning: false, error: msg },
      }));
    }
  };

  // ── Clipboard Paste (Ctrl+V) Logic ─────────────────────────────────────────

  const handlePastedImage = useCallback(
    (file: File, targetSide: 'before' | 'after', targetSlot?: 'honor' | 'ap' | 'speedup' | null) => {
      // If all 3 on this side are filled, and targetSide is 'before' and 'after' has empty slots:
      if (
        targetSide === 'before' &&
        beforeState.honor.preview &&
        beforeState.ap.preview &&
        beforeState.speedup.preview &&
        (!afterState.honor.preview || !afterState.ap.preview || !afterState.speedup.preview)
      ) {
        handleSmartSingleUpload('after', targetSlot || null, file);
        setActiveSide('after');
        return;
      }

      handleSmartSingleUpload(targetSide, targetSlot || null, file);
    },
    [beforeState, afterState, handleSmartSingleUpload]
  );

  // Global window paste listener for Ctrl+V anywhere on the page
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      // If user is focused on a text input and pasting regular text, do not intercept
      const activeEl = document.activeElement;
      const isTextInput =
        activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      const items = e.clipboardData?.items;
      if (!items) return;

      let imageBlob: File | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            imageBlob = new File([blob], `paste_${Date.now()}.png`, { type: blob.type });
            break;
          }
        }
      }

      if (imageBlob) {
        e.preventDefault();
        handlePastedImage(imageBlob, activeSide, activeSlot);
      } else if (isTextInput) {
        // Allow normal text pasting into inputs
      }
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [activeSide, activeSlot, handlePastedImage]);

  // Read image directly from navigator clipboard button
  const handleReadClipboardButton = async (side: 'before' | 'after', slot?: 'honor' | 'ap' | 'speedup') => {
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const file = new File([blob], `clipboard_${Date.now()}.png`, { type });
              handlePastedImage(file, side, slot || null);
              return;
            }
          }
        }
      }
      showToast('⚠️ Không tìm thấy ảnh trong Clipboard. Hãy chụp ảnh (Win + Shift + S) rồi bấm Ctrl+V!');
    } catch {
      showToast('💡 Hãy bấm phím tắt Ctrl + V để dán ảnh vào khung đang chọn!');
    }
  };

  // ── Calculations ───────────────────────────────────────────────────────────

  const apSpent = useMemo(() => {
    const b = beforeState.ap.result?.totalAP;
    const a = afterState.ap.result?.totalAP;
    if (b === undefined || a === undefined) return 0;
    return Math.max(0, b - a);
  }, [beforeState.ap.result, afterState.ap.result]);

  const honorGained = useMemo(() => {
    const b = beforeState.honor.result?.honorValue;
    const a = afterState.honor.result?.honorValue;
    if (b === undefined && a === undefined) return 0;
    if (b === undefined && a !== undefined) return a;
    if (a === undefined && b !== undefined) return 0;
    return Math.max(0, (a || 0) - (b || 0));
  }, [beforeState.honor.result, afterState.honor.result]);

  const accountName = useMemo(() => {
    if (accountOverride.trim()) return accountOverride.trim();
    return (
      afterState.honor.result?.playerName ||
      beforeState.honor.result?.playerName ||
      'ThatMofoKyle(Loki)'
    );
  }, [accountOverride, afterState.honor.result, beforeState.honor.result]);

  const universalSpeed = useMemo(() => {
    const b = beforeState.speedup.result?.universal.totalMinutes;
    const a = afterState.speedup.result?.universal.totalMinutes;
    if (b === undefined || a === undefined) return '+0d 00h 00m';
    return formatSpeedupDelta(a - b);
  }, [beforeState.speedup.result, afterState.speedup.result]);

  const trainingSpeed = useMemo(() => {
    const b = beforeState.speedup.result?.training.totalMinutes;
    const a = afterState.speedup.result?.training.totalMinutes;
    if (b === undefined || a === undefined) return '+0d 00h 00m';
    return formatSpeedupDelta(a - b);
  }, [beforeState.speedup.result, afterState.speedup.result]);

  const healingSpeed = useMemo(() => {
    const b = beforeState.speedup.result?.healing.totalMinutes;
    const a = afterState.speedup.result?.healing.totalMinutes;
    if (b === undefined || a === undefined) return '+0d 00h 00m';
    return formatSpeedupDelta(a - b);
  }, [beforeState.speedup.result, afterState.speedup.result]);

  // Formatted report string
  const reportText = useMemo(() => {
    return [
      `Account: ${accountName}`,
      `Pilot: ${pilot}`,
      `Time: ${time}`,
      `Hours: ${hours}`,
      `Honor Points: ${honorGained.toLocaleString('en-US').replace(/,/g, '')}`,
      `Ap Used: ${apSpent.toLocaleString('en-US').replace(/,/g, '')}`,
      `Universal speed: ${universalSpeed}`,
      `Training speed: ${trainingSpeed}`,
      `Healing speed: ${healingSpeed}`,
      `Note: ${note}`,
    ].join('\n');
  }, [accountName, pilot, time, hours, honorGained, apSpent, universalSpeed, trainingSpeed, healingSpeed, note]);

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      localStorage.setItem('trademan_pilot_name', pilot);
      localStorage.setItem('trademan_pilot_note', note);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = reportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleResetAll = () => {
    setBeforeState(initialSideState());
    setAfterState(initialSideState());
    setActiveSlot(null);
  };

  // Auto-apply values to calculator calculation step whenever AP or Honor are available
  useEffect(() => {
    if (apSpent > 0 || honorGained > 0) {
      onApplyToCalculator(apSpent, honorGained, accountName);
    }
  }, [apSpent, honorGained, accountName, onApplyToCalculator]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900/95 border border-emerald-400 text-emerald-100 px-4 py-3 rounded-xl shadow-glow-green text-xs font-semibold flex items-center gap-2.5 animate-bounce">
          <span className="text-base">📋</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Engine Status Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-game-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-game-accent/20 border border-game-accent/40 flex items-center justify-center text-xl shadow-glow-cyan">
            ⚡
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Quét Báo Cáo Pilot: 3 Ảnh Trước & 3 Ảnh Sau
              <span className="text-[10px] bg-game-accent/20 text-game-accent px-2 py-0.5 rounded font-mono">
                {currentModel}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Hỗ trợ <strong className="text-game-accent">Ctrl + V</strong> dán ảnh trực tiếp từ Clipboard</span>
              <span>·</span>
              <span>Tự động tính số giờ khi đổi Time</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-game-border hover:border-game-accent text-xs font-semibold text-gray-300 hover:text-white transition-colors"
        >
          ⚙️ Cài đặt AI
        </button>
      </div>

      {!aiActive && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-300 flex items-center justify-between">
          <span>⚠️ Vui lòng cấu hình Gemini API Key để quét ảnh bằng AI.</span>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-game-accent underline font-bold ml-2"
          >
            Nhập Key ngay
          </button>
        </div>
      )}

      {/* 2 Main Batch Cards (Before & After) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* ── CARD ĐỢT 1: TRƯỚC KHI CÀY ── */}
        <div
          onClick={() => setActiveSide('before')}
          tabIndex={0}
          className={`game-card border flex flex-col justify-between space-y-4 transition-all outline-none ${
            activeSide === 'before'
              ? 'border-emerald-500/70 shadow-glow-green bg-emerald-950/10'
              : 'border-game-border/80'
          }`}
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-game-border/50">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                ĐỢT 1: 3 ẢNH TRƯỚC KHI CÀY
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReadClipboardButton('before')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 font-medium transition-all flex items-center gap-1"
                  title="Nhấn Ctrl+V hoặc bấm vào đây để dán ảnh từ Clipboard"
                >
                  📋 Dán (Ctrl+V)
                </button>
                <button
                  onClick={() => beforeBatchInputRef.current?.click()}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-black/40 border border-game-border text-gray-300 hover:text-white hover:border-game-accent font-medium transition-all"
                  title="Chọn cùng lúc 3 ảnh"
                >
                  ⚡ Chọn 3 ảnh
                </button>
              </div>
              <input
                ref={beforeBatchInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleBatchUpload('before', e.target.files)}
              />
            </div>

            {/* 3 Slots */}
            <div className="space-y-3 mt-3.5">
              {/* Slot 1: Bảng Danh Dự */}
              <ImageSlotItem<HonorScanResult>
                icon="🎖️"
                title="Bảng Danh Dự"
                hint="Ảnh xếp hạng điểm danh dự & Tên"
                state={beforeState.honor}
                isActive={activeSide === 'before' && activeSlot === 'honor'}
                renderResult={(res) => ({
                  primary: `${res.playerName || 'Không rõ tên'} · ${res.honorValue.toLocaleString()} Điểm`,
                })}
                onFileSelect={(f) => handleSmartSingleUpload('before', 'honor', f)}
                onRemove={() => handleRemoveSlot('before', 'honor')}
                onClick={() => {
                  setActiveSide('before');
                  setActiveSlot('honor');
                }}
                onPasteClick={() => handleReadClipboardButton('before', 'honor')}
              />

              {/* Slot 2: Kho Bình AP */}
              <ImageSlotItem<APScanResult>
                icon="🧪"
                title="Kho Bình AP"
                hint="Ảnh túi đồ chứa bình AP xanh lá (50, 100, 500, 1000)"
                state={beforeState.ap}
                isActive={activeSide === 'before' && activeSlot === 'ap'}
                renderResult={(res) => {
                  const breakdown = res.potions
                    .filter((p) => p.quantity > 0)
                    .map((p) => `${p.cost}: ${p.quantity.toLocaleString()}`)
                    .join(' | ');
                  return {
                    primary: `Tổng: ${res.totalAP.toLocaleString()} AP`,
                    secondary: breakdown || 'Không có bình AP',
                  };
                }}
                onFileSelect={(f) => handleSmartSingleUpload('before', 'ap', f)}
                onRemove={() => handleRemoveSlot('before', 'ap')}
                onClick={() => {
                  setActiveSide('before');
                  setActiveSlot('ap');
                }}
                onPasteClick={() => handleReadClipboardButton('before', 'ap')}
              />

              {/* Slot 3: Kho Tăng Tốc */}
              <ImageSlotItem<SpeedupScanResult>
                icon="⚡"
                title="Kho Tăng Tốc"
                hint="Ảnh tài nguyên hiển thị Tăng tốc, HL, Chữa lành"
                state={beforeState.speedup}
                isActive={activeSide === 'before' && activeSlot === 'speedup'}
                renderResult={(res) => ({
                  primary: `Chung: ${res.universal.rawStr} | HL: ${res.training.rawStr}`,
                  secondary: `Chữa: ${res.healing.rawStr}`,
                })}
                onFileSelect={(f) => handleSmartSingleUpload('before', 'speedup', f)}
                onRemove={() => handleRemoveSlot('before', 'speedup')}
                onClick={() => {
                  setActiveSide('before');
                  setActiveSlot('speedup');
                }}
                onPasteClick={() => handleReadClipboardButton('before', 'speedup')}
              />
            </div>
          </div>
        </div>

        {/* ── CARD ĐỢT 2: SAU KHI CÀY ── */}
        <div
          onClick={() => setActiveSide('after')}
          tabIndex={0}
          className={`game-card border flex flex-col justify-between space-y-4 transition-all outline-none ${
            activeSide === 'after'
              ? 'border-sky-500/70 shadow-glow-cyan bg-sky-950/10'
              : 'border-game-border/80'
          }`}
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-game-border/50">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                ĐỢT 2: 3 ẢNH SAU KHI CÀY
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReadClipboardButton('after')}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/30 font-medium transition-all flex items-center gap-1"
                  title="Nhấn Ctrl+V hoặc bấm vào đây để dán ảnh từ Clipboard"
                >
                  📋 Dán (Ctrl+V)
                </button>
                <button
                  onClick={() => afterBatchInputRef.current?.click()}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-black/40 border border-game-border text-gray-300 hover:text-white hover:border-game-accent font-medium transition-all"
                  title="Chọn cùng lúc 3 ảnh"
                >
                  ⚡ Chọn 3 ảnh
                </button>
              </div>
              <input
                ref={afterBatchInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleBatchUpload('after', e.target.files)}
              />
            </div>

            {/* 3 Slots */}
            <div className="space-y-3 mt-3.5">
              {/* Slot 1: Bảng Danh Dự */}
              <ImageSlotItem<HonorScanResult>
                icon="🎖️"
                title="Bảng Danh Dự"
                hint="Ảnh xếp hạng điểm danh dự & Tên"
                state={afterState.honor}
                isActive={activeSide === 'after' && activeSlot === 'honor'}
                renderResult={(res) => ({
                  primary: `${res.playerName || 'Không rõ tên'} · ${res.honorValue.toLocaleString()} Điểm`,
                })}
                onFileSelect={(f) => handleSmartSingleUpload('after', 'honor', f)}
                onRemove={() => handleRemoveSlot('after', 'honor')}
                onClick={() => {
                  setActiveSide('after');
                  setActiveSlot('honor');
                }}
                onPasteClick={() => handleReadClipboardButton('after', 'honor')}
              />

              {/* Slot 2: Kho Bình AP */}
              <ImageSlotItem<APScanResult>
                icon="🧪"
                title="Kho Bình AP"
                hint="Ảnh túi đồ chứa bình AP xanh lá (50, 100, 500, 1000)"
                state={afterState.ap}
                isActive={activeSide === 'after' && activeSlot === 'ap'}
                renderResult={(res) => {
                  const breakdown = res.potions
                    .filter((p) => p.quantity > 0)
                    .map((p) => `${p.cost}: ${p.quantity.toLocaleString()}`)
                    .join(' | ');
                  return {
                    primary: `Tổng: ${res.totalAP.toLocaleString()} AP`,
                    secondary: breakdown || 'Không có bình AP',
                  };
                }}
                onFileSelect={(f) => handleSmartSingleUpload('after', 'ap', f)}
                onRemove={() => handleRemoveSlot('after', 'ap')}
                onClick={() => {
                  setActiveSide('after');
                  setActiveSlot('ap');
                }}
                onPasteClick={() => handleReadClipboardButton('after', 'ap')}
              />

              {/* Slot 3: Kho Tăng Tốc */}
              <ImageSlotItem<SpeedupScanResult>
                icon="⚡"
                title="Kho Tăng Tốc"
                hint="Ảnh tài nguyên hiển thị Tăng tốc, HL, Chữa lành"
                state={afterState.speedup}
                isActive={activeSide === 'after' && activeSlot === 'speedup'}
                renderResult={(res) => ({
                  primary: `Chung: ${res.universal.rawStr} | HL: ${res.training.rawStr}`,
                  secondary: `Chữa: ${res.healing.rawStr}`,
                })}
                onFileSelect={(f) => handleSmartSingleUpload('after', 'speedup', f)}
                onRemove={() => handleRemoveSlot('after', 'speedup')}
                onClick={() => {
                  setActiveSide('after');
                  setActiveSlot('speedup');
                }}
                onPasteClick={() => handleReadClipboardButton('after', 'speedup')}
              />
            </div>
          </div>
        </div>

      </div>

      {/* ── CLIENT REPORT SECTION ── */}
      <div className="game-card border border-game-border space-y-4">
        <div className="flex items-center justify-between border-b border-game-border/60 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              📋 Báo Cáo Pilot Client (Tự Động Xuất Chuẩn Định Dạng)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Số liệu AP, Danh Dự, và Tốc độ được tự động tính hiệu số Trước - Sau
            </p>
          </div>
          <button
            onClick={handleResetAll}
            className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded bg-black/30 border border-game-border"
          >
            Làm mới
          </button>
        </div>

        {/* Inputs row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-gray-400 block mb-1">Account (Tên)</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountOverride(e.target.value)}
              className="w-full bg-black/40 border border-game-border rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1">Pilot</label>
            <input
              type="text"
              value={pilot}
              onChange={(e) => setPilot(e.target.value)}
              className="w-full bg-black/40 border border-game-border rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1">Time (Thời gian)</label>
            <input
              type="text"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              placeholder="25/10, 0:30 - 13:24"
              className="w-full bg-black/40 border border-game-border rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-game-accent"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1 flex items-center justify-between">
              <span>Hours (Số giờ)</span>
              <span className="text-[10px] text-game-accent">⚡ Tự động tính</span>
            </label>
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full bg-black/40 border border-game-border rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
          </div>
        </div>

        {/* Note input */}
        <div className="text-xs">
          <label className="text-gray-400 block mb-1">Note (Ghi chú)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-black/40 border border-game-border rounded-lg px-2.5 py-1.5 text-white font-mono"
          />
        </div>

        {/* Live Monospace Report */}
        <div className="relative">
          <pre className="p-4 rounded-xl bg-black/70 border border-game-border text-emerald-300 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto whitespace-pre select-all">
            {reportText}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleCopyReport}
            className={`
              flex-1 py-3 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
              ${copied
                ? 'bg-game-success text-white shadow-glow-green'
                : 'bg-game-accent text-black hover:opacity-90 shadow-glow-cyan'
              }
            `}
          >
            {copied ? '✓ Đã Sao Chép Báo Cáo!' : '📋 Sao Chép Báo Cáo'}
          </button>

          {(apSpent > 0 || honorGained > 0) && (
            <button
              onClick={() => {
                onApplyToCalculator(apSpent, honorGained, accountName);
                const el = document.getElementById('scan-calculation-step');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-3 rounded-xl font-semibold text-xs text-game-accent bg-game-accent/10 border border-game-accent/40 hover:bg-game-accent/20 transition-all flex items-center gap-1.5 shadow-glow-cyan"
            >
              📊 Xem Bước Tính Toán Hiệu Suất ↓
            </button>
          )}
        </div>
      </div>

      {isSettingsOpen && <AISettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}