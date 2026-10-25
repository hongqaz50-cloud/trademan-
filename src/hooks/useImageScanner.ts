/**
 * useImageScanner — Custom hook managing the 4-step OCR scanning workflow.
 *
 * Steps:
 *   apBefore    → AP potion screen BEFORE the grind session
 *   apAfter     → AP potion screen AFTER  the grind session
 *   honorBefore → Honor board BEFORE
 *   honorAfter  → Honor board AFTER
 *
 * Derived results:
 *   apSpent     = apBefore.totalAP - apAfter.totalAP
 *   honorGained = honorAfter.honorValue - honorBefore.honorValue
 */

import { useState, useCallback } from 'react';
import { extractTextFromImage } from '@/services/ocrService';
import { parseAPScreen, parseHonorScreen } from '@/utils/ocrParser';
import type {
  ScanStep,
  StepScanState,
  AggregatedScanResult,
  APScanResult,
  HonorScanResult,
} from '@/types/ocr';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SCAN_STEP_ORDER: ScanStep[] = ['apBefore', 'apAfter', 'honorBefore', 'honorAfter'];

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const INITIAL_STEP_STATE: StepScanState = {
  previewUrl: null,
  isScanning: false,
  scanProgress: 0,
  scanError: null,
  isDone: false,
};

const createInitialStepStates = (): Record<ScanStep, StepScanState> => ({
  apBefore: { ...INITIAL_STEP_STATE },
  apAfter: { ...INITIAL_STEP_STATE },
  honorBefore: { ...INITIAL_STEP_STATE },
  honorAfter: { ...INITIAL_STEP_STATE },
});

const INITIAL_AGGREGATED: AggregatedScanResult = {
  apBefore: null,
  apAfter: null,
  apSpent: null,
  honorBefore: null,
  honorAfter: null,
  honorGained: null,
  apBeforePotions: [],
  apAfterPotions: [],
};

// ─── Helper: Update aggregated result after each step ─────────────────────────

function mergeAggregated(
  prev: AggregatedScanResult,
  step: ScanStep,
  apResult?: APScanResult,
  honorResult?: HonorScanResult
): AggregatedScanResult {
  const next: AggregatedScanResult = { ...prev };

  if (step === 'apBefore' && apResult) {
    next.apBefore = apResult.totalAP;
    next.apBeforePotions = apResult.potions;
  } else if (step === 'apAfter' && apResult) {
    next.apAfter = apResult.totalAP;
    next.apAfterPotions = apResult.potions;
  } else if (step === 'honorBefore' && honorResult) {
    next.honorBefore = honorResult.honorValue;
  } else if (step === 'honorAfter' && honorResult) {
    next.honorAfter = honorResult.honorValue;
  }

  // Recompute derived values
  if (next.apBefore !== null && next.apAfter !== null) {
    next.apSpent = Math.max(0, next.apBefore - next.apAfter);
  }
  if (next.honorBefore !== null && next.honorAfter !== null) {
    next.honorGained = Math.max(0, next.honorAfter - next.honorBefore);
  }

  return next;
}

// ─── Hook Return Type ─────────────────────────────────────────────────────────

export interface UseImageScannerReturn {
  currentStep: ScanStep;
  stepStates: Record<ScanStep, StepScanState>;
  aggregated: AggregatedScanResult;
  isDraggingOver: boolean;
  allStepsDone: boolean;
  handleFileSelect: (file: File) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleClearStep: (step: ScanStep) => void;
  goToStep: (step: ScanStep) => void;
  handleConfirm: (apSpent: number, honorGained: number) => void;
  /** Override AP result after user manually edits quantities in the table */
  overrideAPResult: (step: 'apBefore' | 'apAfter', result: APScanResult) => void;
  resetScanner: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useImageScanner(
  onScanComplete: (apSpent: number, honorGained: number) => void
): UseImageScannerReturn {
  const [currentStep, setCurrentStep] = useState<ScanStep>('apBefore');
  const [stepStates, setStepStates] = useState<Record<ScanStep, StepScanState>>(
    createInitialStepStates
  );
  const [aggregated, setAggregated] = useState<AggregatedScanResult>(INITIAL_AGGREGATED);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // ─── State updaters ───────────────────────────────────────────────────────

  const updateStep = useCallback((step: ScanStep, patch: Partial<StepScanState>) => {
    setStepStates((prev) => ({
      ...prev,
      [step]: { ...prev[step], ...patch },
    }));
  }, []);

  // ─── Core process: validate + OCR + parse ────────────────────────────────

  const processFile = useCallback(
    async (file: File, step: ScanStep) => {
      // 1. Validate
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        updateStep(step, { scanError: 'Chỉ chấp nhận ảnh PNG, JPG, WebP.' });
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        updateStep(step, { scanError: 'Ảnh quá lớn. Vui lòng chọn ảnh dưới 10MB.' });
        return;
      }

      // 2. Create preview + start scanning state
      const previewUrl = URL.createObjectURL(file);
      updateStep(step, {
        previewUrl,
        isScanning: true,
        scanProgress: 0,
        scanError: null,
        isDone: false,
        apResult: undefined,
        honorResult: undefined,
      });

      try {
        // 3. Run OCR
        const { text } = await extractTextFromImage(file, (progress) => {
          updateStep(step, { scanProgress: progress });
        });

        // 4. Parse based on step type
        let apResult: APScanResult | undefined;
        let honorResult: HonorScanResult | undefined;

        if (step === 'apBefore' || step === 'apAfter') {
          apResult = parseAPScreen(text);
        } else {
          honorResult = parseHonorScreen(text);
        }

        // 5. Update step state as done
        updateStep(step, {
          isScanning: false,
          scanProgress: 100,
          isDone: true,
          rawOCRText: text,
          apResult,
          honorResult,
        });

        // 6. Merge into aggregated results
        setAggregated((prev) => mergeAggregated(prev, step, apResult, honorResult));

      } catch {
        updateStep(step, {
          isScanning: false,
          scanError: 'Không thể nhận diện ảnh. Vui lòng thử ảnh khác có độ phân giải cao hơn.',
          isDone: false,
        });
      }
    },
    [updateStep]
  );

  // ─── Public handlers ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (file: File) => { processFile(file, currentStep); },
    [currentStep, processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file, currentStep);
    },
    [currentStep, processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) processFile(file, currentStep);
      }
    },
    [currentStep, processFile]
  );

  const handleClearStep = useCallback(
    (step: ScanStep) => {
      const state = stepStates[step];
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);

      setStepStates((prev) => ({
        ...prev,
        [step]: { ...INITIAL_STEP_STATE },
      }));

      // Clear corresponding aggregated data
      setAggregated((prev) => {
        const next = { ...prev };
        if (step === 'apBefore') { next.apBefore = null; next.apBeforePotions = []; next.apSpent = null; }
        if (step === 'apAfter')  { next.apAfter = null;  next.apAfterPotions = [];  next.apSpent = null; }
        if (step === 'honorBefore') { next.honorBefore = null; next.honorGained = null; }
        if (step === 'honorAfter')  { next.honorAfter = null;  next.honorGained = null; }
        return next;
      });
    },
    [stepStates]
  );

  const goToStep = useCallback((step: ScanStep) => setCurrentStep(step), []);

  const handleConfirm = useCallback(
    (apSpent: number, honorGained: number) => {
      onScanComplete(apSpent, honorGained);
    },
    [onScanComplete]
  );

  /**
   * Allows the editable AP quantity table to push updated results back into
   * the aggregated state without rescanning the image.
   */
  const overrideAPResult = useCallback(
    (step: 'apBefore' | 'apAfter', result: APScanResult) => {
      updateStep(step, { apResult: result });
      setAggregated((prev) => {
        const next = { ...prev };
        if (step === 'apBefore') {
          next.apBefore = result.totalAP;
          next.apBeforePotions = result.potions;
        } else {
          next.apAfter = result.totalAP;
          next.apAfterPotions = result.potions;
        }
        if (next.apBefore !== null && next.apAfter !== null) {
          next.apSpent = Math.max(0, next.apBefore - next.apAfter);
        }
        return next;
      });
    },
    [updateStep]
  );

  const resetScanner = useCallback(() => {
    // Revoke all preview URLs
    Object.values(stepStates).forEach((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });
    setStepStates(createInitialStepStates());
    setAggregated(INITIAL_AGGREGATED);
    setCurrentStep('apBefore');
    setIsDraggingOver(false);
  }, [stepStates]);

  const allStepsDone = SCAN_STEP_ORDER.every((s) => stepStates[s].isDone);

  return {
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
  };
}
