/**
 * App.tsx — Root component. Only responsibility: layout shell + render CalculatorView.
 * No business logic, no state. Just structure.
 */

import { CalculatorView } from '@/features/calculator/CalculatorView';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-game-border/50 backdrop-blur-sm sticky top-0 z-50 bg-game-bg/80">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-accent flex items-center justify-center text-lg shadow-glow-cyan">
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">
                AP Efficiency Calculator
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Game Performance Analyzer</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-black/20 border border-game-border/50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-game-success animate-pulse inline-block" />
            Online
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="border-b border-game-border/30 bg-gradient-to-r from-transparent via-game-glow to-transparent">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <div className="inline-flex items-center gap-2 bg-black/30 border border-game-accent/30 rounded-full px-4 py-1.5 text-xs font-semibold text-game-accent mb-4">
            <span>🎮</span> Game AP Performance Tool
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
            Đo Lường{' '}
            <span className="text-gradient-accent">Hiệu Suất</span>{' '}
            Chiến Đấu
          </h2>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Nhập số AP đã tiêu hao và điểm Danh Dự tích lũy để phân tích hiệu quả chiến đấu
            so với mức chuẩn <strong className="text-gray-300">3 quái / 65 AP</strong>.
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1">
        <CalculatorView />
      </main>

      {/* Footer */}
      <footer className="border-t border-game-border/30 py-5">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-gray-600">
          AP Efficiency Calculator · Baseline: 3 Monsters / 65 AP · 10 Honor / Monster
        </div>
      </footer>
    </div>
  );
}

export default App;
