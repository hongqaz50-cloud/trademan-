/**
 * DiscordLoginGate.tsx — Full-page or view-level barrier requiring Discord authentication.
 */



interface DiscordLoginGateProps {
  onLogin: () => void;
}

export function DiscordLoginGate({ onLogin }: DiscordLoginGateProps) {
  return (
    <div className="max-w-xl mx-auto px-4 py-12 animate-fade-in">
      <div className="relative rounded-3xl bg-game-card/90 border border-game-border p-8 sm:p-10 shadow-2xl backdrop-blur-md text-center overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#5865F2]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Discord Shield Icon */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/50 shadow-lg shadow-[#5865F2]/25 mb-6">
          <svg className="w-11 h-11 fill-[#5865F2]" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </div>

        {/* Lock Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
          <span>🔒</span>
          <span>Yêu Cầu Xác Thực Quyền Truy Cập</span>
        </div>

        {/* Heading */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
          Đăng Nhập Discord Để Mở Khóa
        </h2>

        {/* Subtitle */}
        <p className="text-gray-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
          Vui lòng đăng nhập bằng tài khoản Discord của bạn để sử dụng công cụ tính toán hiệu suất AP và tính năng quét ảnh tự động.
        </p>

        {/* Main CTA Button */}
        <button
          onClick={onLogin}
          type="button"
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm shadow-xl shadow-[#5865F2]/30 flex items-center justify-center gap-3 mx-auto transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          <span>Đăng Nhập Với Discord (1 Chạm)</span>
        </button>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 pt-8 border-t border-game-border/40 text-left">
          <div className="p-3.5 rounded-xl bg-black/30 border border-game-border/50">
            <div className="text-base mb-1">🛡️</div>
            <div className="text-xs font-bold text-white mb-0.5">Bảo Vệ Công Cụ</div>
            <div className="text-[11px] text-gray-400">Chỉ người dùng Discord được cấp quyền sử dụng.</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/30 border border-game-border/50">
            <div className="text-base mb-1">⚡</div>
            <div className="text-xs font-bold text-white mb-0.5">Tự Điền Pilot</div>
            <div className="text-[11px] text-gray-400">Tự động lấy tên hiển thị Discord của bạn vào báo cáo.</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/30 border border-game-border/50">
            <div className="text-base mb-1">📊</div>
            <div className="text-xs font-bold text-white mb-0.5">Quét & Tính Toán</div>
            <div className="text-[11px] text-gray-400">Mở khóa đầy đủ quét 4 ảnh và phân tích hiệu suất AP.</div>
          </div>
        </div>

        {/* Helpful note */}
        <p className="text-[11px] text-gray-500 mt-6">
          Hệ thống kết nối an toàn qua giao thức Discord OAuth2 chính thức.
        </p>
      </div>
    </div>
  );
}
