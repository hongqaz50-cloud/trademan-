/**
 * PilotReportModal.tsx — Formats and exports a pilot/grinder session report for clients.
 * Matches exact format:
 *   Account: ThatMofoKyle(Loki)
 *   Pilot: Hunter
 *   Time: 24/10, 0:30 - 15:24
 *   Hours: 14,9
 *   Honor Points: 16474
 *   Ap Used: 34850
 *   Universal speed: +5d 22h 25m
 *   Training speed: +16d 20h 30m
 *   Healing speed: +5d 11h 45m
 *   Note: 5 marches
 */

import { useState, useMemo } from 'react';

const STORAGE_ACCOUNT = 'trademan_pilot_account';
const STORAGE_PILOT = 'trademan_pilot_name';
const STORAGE_NOTE = 'trademan_pilot_note';

interface PilotReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  apSpent: number;
  honorGained: number;
}

export function PilotReportModal({
  isOpen,
  onClose,
  apSpent,
  honorGained,
}: PilotReportModalProps) {
  // Form fields
  const [account, setAccount] = useState(() => localStorage.getItem(STORAGE_ACCOUNT) || 'ThatMofoKyle(Loki)');
  const [pilot, setPilot] = useState(() => localStorage.getItem(STORAGE_PILOT) || 'Hunter');
  
  const defaultTime = useMemo(() => {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${d}/${m}, 08:00 - 18:00`;
  }, []);

  const [time, setTime] = useState(defaultTime);
  const [hours, setHours] = useState('10,0');
  const [universalSpeed, setUniversalSpeed] = useState('+2d 09h 00m');
  const [trainingSpeed, setTrainingSpeed] = useState('+4d 19h 25m');
  const [healingSpeed, setHealingSpeed] = useState('+2d 00h 10m');
  const [note, setNote] = useState(() => localStorage.getItem(STORAGE_NOTE) || '5 marches');

  const [copied, setCopied] = useState(false);

  // Generate formatted text
  const reportText = useMemo(() => {
    return [
      `Account: ${account.trim() || '—'}`,
      `Pilot: ${pilot.trim() || '—'}`,
      `Time: ${time.trim() || '—'}`,
      `Hours: ${hours.trim() || '—'}`,
      `Honor Points: ${honorGained.toLocaleString('en-US').replace(/,/g, '')}`,
      `Ap Used: ${apSpent.toLocaleString('en-US').replace(/,/g, '')}`,
      `Universal speed: ${universalSpeed.trim() || '+0d 00h 00m'}`,
      `Training speed: ${trainingSpeed.trim() || '+0d 00h 00m'}`,
      `Healing speed: ${healingSpeed.trim() || '+0d 00h 00m'}`,
      `Note: ${note.trim() || '5 marches'}`,
    ].join('\n');
  }, [account, pilot, time, hours, honorGained, apSpent, universalSpeed, trainingSpeed, healingSpeed, note]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      // Persist preferences
      localStorage.setItem(STORAGE_ACCOUNT, account);
      localStorage.setItem(STORAGE_PILOT, pilot);
      localStorage.setItem(STORAGE_NOTE, note);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback if clipboard API is blocked
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-game-card border border-game-border rounded-2xl shadow-2xl p-6 space-y-5 text-gray-200 max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-game-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-game-accent/20 border border-game-accent/40 flex items-center justify-center text-game-accent text-lg shadow-glow-cyan">
              📋
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Xuất Báo Cáo Ca Cày (Pilot Report)</h2>
              <p className="text-xs text-gray-400">Định dạng chuẩn gửi khách hàng qua Discord / Zalo / Telegram</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 text-gray-400 hover:text-white hover:bg-black/70 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* Account */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">Tên Account (Khách hàng)</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="ThatMofoKyle(Loki)"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Pilot */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">Tên Pilot (Tự điền)</label>
            <input
              type="text"
              value={pilot}
              onChange={(e) => setPilot(e.target.value)}
              placeholder="Hunter"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-game-accent font-mono font-bold focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">Thời gian (Time)</label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="24/10, 0:30 - 15:24"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Hours */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">Số giờ cày (Hours)</label>
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="14,9"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Honor Points (Read only / auto) */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">🏅 Honor Points (Từ tính toán)</label>
            <input
              type="text"
              value={honorGained.toLocaleString('en-US').replace(/,/g, '')}
              readOnly
              className="w-full bg-black/60 border border-game-gold/40 rounded-lg px-3 py-2 text-game-gold font-mono font-bold cursor-not-allowed"
            />
          </div>

          {/* AP Used (Read only / auto) */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">⚡ AP Used (Từ tính toán)</label>
            <input
              type="text"
              value={apSpent.toLocaleString('en-US').replace(/,/g, '')}
              readOnly
              className="w-full bg-black/60 border border-game-accent/40 rounded-lg px-3 py-2 text-game-accent font-mono font-bold cursor-not-allowed"
            />
          </div>

          {/* Universal speed */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">⏱️ Universal speed (Tăng tốc chung)</label>
            <input
              type="text"
              value={universalSpeed}
              onChange={(e) => setUniversalSpeed(e.target.value)}
              placeholder="+5d 22h 25m"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Training speed */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">🏹 Training speed (Tăng tốc lính)</label>
            <input
              type="text"
              value={trainingSpeed}
              onChange={(e) => setTrainingSpeed(e.target.value)}
              placeholder="+16d 20h 30m"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Healing speed */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">🩹 Healing speed (Tăng tốc viện)</label>
            <input
              type="text"
              value={healingSpeed}
              onChange={(e) => setHealingSpeed(e.target.value)}
              placeholder="+5d 11h 45m"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">📝 Note (Ghi chú)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="5 marches"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">Bản xem trước báo cáo (Live Preview):</span>
            <span className="text-[11px] text-gray-500">1 click copy để dán gửi ngay</span>
          </div>
          <div className="relative">
            <pre className="p-4 bg-black/60 border border-game-border rounded-xl font-mono text-xs text-gray-200 whitespace-pre leading-relaxed select-all">
              {reportText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-game-border/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-black/30 transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-glow-cyan ${
              copied
                ? 'bg-game-success text-white'
                : 'bg-game-accent text-black hover:brightness-110'
            }`}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Đã sao chép vào Clipboard!' : 'Sao chép báo cáo (Copy Report)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}