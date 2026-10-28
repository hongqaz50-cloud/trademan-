/**
 * App.tsx — Root component. Only responsibility: layout shell + render CalculatorView.
 * No business logic, no state. Just structure.
 */

import { useState, useEffect } from 'react';
import { CalculatorView } from '@/features/calculator/CalculatorView';
import { AISettingsModal } from '@/components/AISettingsModal';
import { DiscordAuthModal } from '@/components/DiscordAuthModal';
import { DiscordLoginGate } from '@/components/DiscordLoginGate';
import { isAIEnabled, getStoredApiKey, getStoredModel } from '@/services/aiVisionService';
import {
  getStoredDiscordUser,
  handleDiscordAuthCallback,
  getDiscordAvatarUrl,
  initiateDiscordLogin,
  type DiscordUser,
} from '@/services/discordAuthService';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDiscordOpen, setIsDiscordOpen] = useState(false);
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(getStoredDiscordUser);
  const [authError, setAuthError] = useState<string | null>(null);
  const [, setRefreshKey] = useState(0);

  // Check for Discord OAuth redirect on mount
  useEffect(() => {
    handleDiscordAuthCallback().then(({ user, error }) => {
      if (user) {
        setDiscordUser(user);
        // Also sync pilot name to localStorage
        localStorage.setItem('trademan_pilot_name', user.global_name || user.username);
      } else if (error) {
        setAuthError(error);
        setTimeout(() => setAuthError(null), 6000);
      }
    });
  }, []);

  const handleDiscordClick = () => {
    if (discordUser) {
      setIsDiscordOpen(true);
      return;
    }
    initiateDiscordLogin();
  };

  const aiActive = isAIEnabled() && Boolean(getStoredApiKey());
  const currentModel = getStoredModel();

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Discord OAuth Error Toast */}
      {authError && (
        <div className="fixed top-20 right-6 z-50 bg-red-950/95 border border-red-500 text-red-200 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>⚠️</span>
          <span>{authError}</span>
        </div>
      )}

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
          <div className="flex items-center gap-2.5">
            {/* Discord Login Button */}
            {discordUser ? (
              <button
                onClick={handleDiscordClick}
                className="flex items-center gap-2 text-xs pl-1.5 pr-3 py-1 rounded-full bg-black/40 border border-[#5865F2]/60 text-white hover:border-[#5865F2] hover:bg-[#5865F2]/10 transition-all shadow-glow-cyan"
                title={`Đã đăng nhập Discord: ${discordUser.global_name || discordUser.username}`}
              >
                <img
                  src={getDiscordAvatarUrl(discordUser)}
                  alt="Discord Avatar"
                  className="w-5 h-5 rounded-full border border-[#5865F2]"
                />
                <span className="font-semibold max-w-[110px] truncate text-white">
                  {discordUser.global_name || discordUser.username}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            ) : (
              <button
                onClick={handleDiscordClick}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/60 text-white hover:bg-[#5865F2]/30 transition-all shadow-glow-cyan"
                title="Đăng nhập tài khoản Discord"
              >
                <svg className="w-3.5 h-3.5 fill-current text-[#5865F2]" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                <span className="font-semibold hidden sm:inline">Discord</span>
                <span className="sm:hidden font-semibold">Discord</span>
              </button>
            )}

            {/* AI Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                aiActive
                  ? 'bg-game-accent/15 border-game-accent text-game-accent shadow-glow-cyan hover:bg-game-accent/25'
                  : 'bg-black/20 border-game-border text-gray-400 hover:text-white hover:border-gray-500'
              }`}
              title="Cài đặt AI Vision (Gemini Flash-Lite)"
            >
              <span>{aiActive ? '🤖' : '⚙️'}</span>
              <span className="font-semibold hidden sm:inline">
                {aiActive ? `${currentModel}` : 'Cài đặt AI'}
              </span>
              <span className="sm:hidden font-semibold">AI</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-black/20 border border-game-border/50 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-game-success animate-pulse inline-block" />
              Online
            </div>
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
        {discordUser ? (
          <CalculatorView />
        ) : (
          <DiscordLoginGate onLogin={() => initiateDiscordLogin()} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-game-border/30 py-5">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-gray-600">
          AP Efficiency Calculator · Baseline: 3 Monsters / 65 AP · 10 Honor / Monster
        </div>
      </footer>

      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChanged={() => setRefreshKey((k) => k + 1)}
      />

      {/* Discord Auth Modal */}
      <DiscordAuthModal
        isOpen={isDiscordOpen}
        onClose={() => setIsDiscordOpen(false)}
        onUserChanged={(user) => {
          setDiscordUser(user);
          if (user) {
            localStorage.setItem('trademan_pilot_name', user.global_name || user.username);
          }
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

export default App;
