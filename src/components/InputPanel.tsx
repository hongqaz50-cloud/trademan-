/**
 * InputPanel — Form container with two input fields and action buttons.
 * Receives all state and handlers from the parent via props (dumb component).
 */

import type { APFormValues, FormErrors } from '@/types/calculator';
import { InputField } from '@/components/ui/InputField';
import { AP_PER_RUN, BASELINE_MONSTERS_PER_RUN, HONOR_PER_MONSTER } from '@/constants/gameConfig';

interface InputPanelProps {
  formValues: APFormValues;
  errors: FormErrors;
  hasCalculated: boolean;
  onChange: (field: keyof APFormValues, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function InputPanel({
  formValues,
  errors,
  hasCalculated,
  onChange,
  onSubmit,
  onReset,
}: InputPanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
  };

  return (
    <div className="game-card border border-game-border flex flex-col gap-6" onKeyDown={handleKeyDown}>
      {/* Panel header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>⚔️</span>
          <span>Nhập Dữ Liệu Chiến Đấu</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Nhập số AP đã tiêu và điểm Danh Dự kiếm được để tính hiệu suất.
        </p>
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-5">
        <InputField
          id="ap-spent"
          icon="⚡"
          label="AP Đã Sử Dụng"
          value={formValues.apSpent}
          onChange={(val) => onChange('apSpent', val)}
          error={errors.apSpent}
          placeholder=""
          unit="AP"
          hint={`Mỗi lượt run = ${AP_PER_RUN} AP`}
        />
        <InputField
          id="honor-gained"
          icon="🏅"
          label="Điểm Danh Dự Kiếm Được"
          value={formValues.honorGained}
          onChange={(val) => onChange('honorGained', val)}
          error={errors.honorGained}
          placeholder=""
          unit="HP"
          hint={`1 quái = ${HONOR_PER_MONSTER} điểm | Baseline: ${BASELINE_MONSTERS_PER_RUN} quái/lượt`}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          id="btn-calculate"
          type="button"
          onClick={onSubmit}
          className="game-btn-primary flex-1 text-white flex items-center justify-center gap-2"
        >
          <span>🚀</span>
          <span>Tính Toán</span>
        </button>
        {hasCalculated && (
          <button
            id="btn-reset"
            type="button"
            onClick={onReset}
            className="game-btn-secondary flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
