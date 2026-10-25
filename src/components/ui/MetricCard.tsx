/**
 * MetricCard — Displays a single calculated metric in a game-dashboard style card.
 * Shows: icon, label, formatted value, unit, and optional highlight glow.
 */

interface MetricCardProps {
  id: string;
  icon: string;
  label: string;
  value: string;
  unit?: string;
  sublabel?: string;
  glowColor?: 'cyan' | 'gold' | 'green' | 'red' | 'purple';
  highlight?: boolean;
}

const GLOW_MAP: Record<string, string> = {
  cyan: 'border-game-accent shadow-glow-cyan',
  gold: 'border-game-gold shadow-glow-gold',
  green: 'border-game-success shadow-glow-green',
  red: 'border-game-danger shadow-glow-red',
  purple: 'border-game-purple shadow-glow-purple',
};

const VALUE_COLOR_MAP: Record<string, string> = {
  cyan: 'text-gradient-accent',
  gold: 'text-gradient-gold',
  green: 'text-game-success',
  red: 'text-game-danger',
  purple: 'text-game-purple',
};

export function MetricCard({
  id,
  icon,
  label,
  value,
  unit,
  sublabel,
  glowColor = 'cyan',
  highlight = false,
}: MetricCardProps) {
  const borderClass = highlight ? GLOW_MAP[glowColor] : 'border-game-border';
  const valueClass = highlight ? VALUE_COLOR_MAP[glowColor] : 'text-white';

  return (
    <div
      id={id}
      className={`game-card border transition-all duration-500 animate-slide-up ${borderClass}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {label}
        </span>
      </div>

      {/* Value display */}
      <div className="flex items-end gap-2">
        <span
          className={`font-mono font-bold leading-none ${valueClass} ${
            highlight ? 'text-4xl' : 'text-3xl'
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm text-gray-500 font-medium mb-1">{unit}</span>
        )}
      </div>

      {/* Sublabel */}
      {sublabel && (
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{sublabel}</p>
      )}
    </div>
  );
}
