/**
 * useAPCalculator — Custom hook managing all form state and calculation logic.
 * Single source of truth for the calculator feature state.
 * Components using this hook receive clean props; they know nothing about business logic.
 */

import { useState, useCallback } from 'react';
import type { APFormValues, CalculationResult, FormErrors } from '@/types/calculator';
import { validateInputs, calculateAll } from '@/utils/apCalculator';

interface UseAPCalculatorReturn {
  formValues: APFormValues;
  errors: FormErrors;
  result: CalculationResult | null;
  hasCalculated: boolean;
  handleChange: (field: keyof APFormValues, value: string) => void;
  handleSubmit: () => void;
  handleReset: () => void;
  /** Inject values from OCR scan and auto-calculate */
  injectValues: (apSpent: number | null, honorGained: number | null) => void;
}

const INITIAL_FORM_VALUES: APFormValues = {
  apSpent: '',
  honorGained: '',
};

export function useAPCalculator(): UseAPCalculatorReturn {
  const [formValues, setFormValues] = useState<APFormValues>(INITIAL_FORM_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  /**
   * Sanitizes and updates a single form field.
   * Only allows numeric characters and a single decimal point.
   * Clears the field-specific error on change.
   */
  const handleChange = useCallback(
    (field: keyof APFormValues, value: string) => {
      // Allow empty string, digits, and a single decimal point
      const sanitized = value.replace(/[^0-9.]/g, '');
      // Prevent multiple decimal points
      const parts = sanitized.split('.');
      const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;

      setFormValues((prev) => ({ ...prev, [field]: clean }));
      // Clear error for this field when user starts typing
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  /**
   * Validates inputs then runs the calculation pipeline.
   * Sets errors if validation fails; sets result if successful.
   */
  const handleSubmit = useCallback(() => {
    const validationErrors = validateInputs(formValues);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    const ap = parseFloat(formValues.apSpent);
    const honor = parseFloat(formValues.honorGained);
    const calculationResult = calculateAll(ap, honor);
    setResult(calculationResult);
    setHasCalculated(true);
  }, [formValues]);

  /**
   * Resets the entire form back to initial state.
   */
  const handleReset = useCallback(() => {
    setFormValues(INITIAL_FORM_VALUES);
    setErrors({});
    setResult(null);
    setHasCalculated(false);
  }, []);

  /**
   * Injects OCR-scanned values directly into the form and auto-triggers calculation.
   * Called by CalculatorView after a successful image scan.
   */
  const injectValues = useCallback(
    (apSpent: number | null, honorGained: number | null) => {
      const newValues: APFormValues = {
        apSpent: apSpent !== null ? String(apSpent) : '',
        honorGained: honorGained !== null ? String(honorGained) : '',
      };

      setFormValues(newValues);
      setErrors({});

      // Auto-calculate if both values are valid
      if (apSpent !== null && honorGained !== null && apSpent > 0 && honorGained >= 0) {
        const calc = calculateAll(apSpent, honorGained);
        setResult(calc);
        setHasCalculated(true);
      }
    },
    []
  );

  return {
    formValues,
    errors,
    result,
    hasCalculated,
    handleChange,
    handleSubmit,
    handleReset,
    injectValues,
  };
}
