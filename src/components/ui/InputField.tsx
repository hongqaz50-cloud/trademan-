/**
 * InputField — Reusable game-styled text input component.
 * Displays label, optional unit badge, value, and validation error message.
 * Fully controlled (value + onChange from parent).
 */

import type { ChangeEvent } from 'react';

interface InputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  unit?: string;
  hint?: string;
  icon?: string;
}

export function InputField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = '0',
  unit,
  hint,
  icon,
}: InputFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Label row */}
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <label
          htmlFor={id}
          className="text-sm font-semibold text-gray-300 tracking-wide uppercase"
        >
          {label}
        </label>
      </div>

      {/* Input wrapper */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="number"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`game-input pr-${unit ? '16' : '4'} ${error ? 'error' : ''}`}
        />
        {unit && (
          <span className="absolute right-3 text-xs font-semibold text-game-accent bg-game-border px-2 py-1 rounded-md pointer-events-none">
            {unit}
          </span>
        )}
      </div>

      {/* Hint text */}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-game-danger flex items-center gap-1 animate-fade-in"
        >
          <span>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
