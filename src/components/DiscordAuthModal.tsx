/**
 * DiscordAuthModal.tsx — Discord Profile & Auth Modal
 * Simplified: All developer configuration clutter removed.
 */

import {
  initiateDiscordLogin,
  getStoredDiscordUser,
  setStoredDiscordUser,
  getDiscordAvatarUrl,
  type DiscordUser,
} from '@/services/discordAuthService';

interface DiscordAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChanged: (user: DiscordUser | null) => void;
}

export function DiscordAuthModal({ isOpen, onClose, onUserChanged }: DiscordAuthModalProps) {
  const currentUser = getStoredDiscordUser();

  if (!isOpen) return null;

  const handleStartOAuth = () => {
    initiateDiscordLogin();
  };

  const handleLogout = () => {
    setStoredDiscordUser(null);
    onUserChanged(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-game-card border border-game-border p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-game-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/50 flex items-center justify-center text-xl text-[#5865F2]">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Tài Khoản Discord</h3>
              <p className="text-xs text-gray-400">
                {currentUser ? 'Thông tin cá nhân' : 'Đăng nhập hệ thống'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-black/30 hover:bg-black/50 text-gray-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {currentUser ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-black/40 border border-[#5865F2]/40 flex items-center gap-3.5">
              <img
                src={getDiscordAvatarUrl(currentUser)}
                alt={currentUser.username}
                className="w-14 h-14 rounded-full border-2 border-[#5865F2] shadow-lg shadow-[#5865F2]/20"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#5865F2] font-semibold flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Đang hoạt động
                </div>
                <div className="text-base font-bold text-white truncate">
                  {currentUser.global_name || currentUser.username}
                </div>
                <div className="text-xs text-gray-400 font-mono truncate">
                  @{currentUser.username}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-gray-400 bg-black/30 border border-game-border/40 p-2.5 rounded-lg flex items-center justify-between">
              <span className="text-gray-500">ID Người Dùng:</span>
              <span className="font-mono text-gray-300">{currentUser.id}</span>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-xs font-semibold transition-all"
              >
                Đăng Xuất Discord
              </button>
              <button
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl bg-game-accent text-black font-bold text-xs hover:brightness-110"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-xs text-gray-300">
              Đăng nhập bằng tài khoản Discord để mở khóa toàn bộ tính năng quét ảnh và tính toán hiệu suất.
            </p>
            <button
              type="button"
              onClick={handleStartOAuth}
              className="w-full py-3 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-glow-cyan transition-all"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Đăng Nhập Bằng Discord</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
