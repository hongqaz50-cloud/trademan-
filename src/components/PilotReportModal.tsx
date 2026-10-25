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
 *
 * Capabilities:
 * - Ô Account: tự động lấy từ tên trong ảnh Bảng Danh Dự (playerName) hoặc tự sửa
 * - Hours: tự nhập số giờ hoặc tính từ Time, ngày tháng tự gợi ý
 * - Universal speed, Training speed, Healing speed: tự động tính khi tải lên 2 ảnh Tăng Tốc (Trước/Sau)
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  scanSpeedupWithAI,
  formatSpeedupDelta,
} from '@/services/aiVisionService';
import type { SpeedupScanResult } from '@/types/ocr';

const STORAGE_ACCOUNT = 'trademan_pilot_account';
const STORAGE_PILOT = 'trademan_pilot_name';
const STORAGE_NOTE = 'trademan_pilot_note';

interface PilotReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  apSpent: number;
  honorGained: number;
  scannedAccount?: string;
}

export function PilotReportModal({
  isOpen,
  onClose,
  apSpent,
  honorGained,
  scannedAccount,
}: PilotReportModalProps) {
  // Account field: prioritize scannedAccount if available, else localStorage
  const [account, setAccount] = useState(() => {
    return scannedAccount || localStorage.getItem(STORAGE_ACCOUNT) || 'ThatMofoKyle(Loki)';
  });

  useEffect(() => {
    if (scannedAccount) {
      setAccount(scannedAccount);
    }
  }, [scannedAccount]);

  // Pilot field (persisted)
  const [pilot, setPilot] = useState(() => localStorage.getItem(STORAGE_PILOT) || 'Hunter');

  // Time & Hours fields
  const defaultTime = useMemo(() => {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${d}/${m}, 08:30 - 18:50`;
  }, []);

  const [time, setTime] = useState(defaultTime);
  const [hours, setHours] = useState('10,3');

  // Speedups fields (can be edited manually OR auto-calculated from photos)
  const [universalSpeed, setUniversalSpeed] = useState('+2d 09h 00m');
  const [trainingSpeed, setTrainingSpeed] = useState('+4d 19h 25m');
  const [healingSpeed, setHealingSpeed] = useState('+2d 00h 10m');
  const [note, setNote] = useState(() => localStorage.getItem(STORAGE_NOTE) || '5 marches');

  // Speedup photo upload state
  const [speedupBeforeData, setSpeedupBeforeData] = useState<SpeedupScanResult | null>(null);
  const [speedupAfterData, setSpeedupAfterData] = useState<SpeedupScanResult | null>(null);
  const [beforePreviewUrl, setBeforePreviewUrl] = useState<string | null>(null);
  const [afterPreviewUrl, setAfterPreviewUrl] = useState<string | null>(null);
  const [isScanningBefore, setIsScanningBefore] = useState(false);
  const [isScanningAfter, setIsScanningAfter] = useState(false);
  const [speedupScanError, setSpeedupScanError] = useState<string | null>(null);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const [copied, setCopied] = useState(false);

  // Auto-recalculate speedup deltas whenever beforeData or afterData updates
  useEffect(() => {
    if (speedupBeforeData && speedupAfterData) {
      const deltaUni = speedupAfterData.universal.totalMinutes - speedupBeforeData.universal.totalMinutes;
      const deltaTrain = speedupAfterData.training.totalMinutes - speedupBeforeData.training.totalMinutes;
      const deltaHeal = speedupAfterData.healing.totalMinutes - speedupBeforeData.healing.totalMinutes;

      setUniversalSpeed(formatSpeedupDelta(deltaUni));
      setTrainingSpeed(formatSpeedupDelta(deltaTrain));
      setHealingSpeed(formatSpeedupDelta(deltaHeal));
    }
  }, [speedupBeforeData, speedupAfterData]);

  // Handler for scanning Before speedup photo
  const handleBeforeFile = async (file: File) => {
    setSpeedupScanError(null);
    setIsScanningBefore(true);
    setBeforePreviewUrl(URL.createObjectURL(file));
    try {
      const data = await scanSpeedupWithAI(file);
      setSpeedupBeforeData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSpeedupScanError(`Lỗi quét ảnh Tăng Tốc Trước: ${msg}`);
    } finally {
      setIsScanningBefore(false);
    }
  };

  // Handler for scanning After speedup photo
  const handleAfterFile = async (file: File) => {
    setSpeedupScanError(null);
    setIsScanningAfter(true);
    setAfterPreviewUrl(URL.createObjectURL(file));
    try {
      const data = await scanSpeedupWithAI(file);
      setSpeedupAfterData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSpeedupScanError(`Lỗi quét ảnh Tăng Tốc Sau: ${msg}`);
    } finally {
      setIsScanningAfter(false);
    }
  };

  // Generate formatted text matching user's requested specification
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

        {/* ── Auto-Calculate Speedups via Photo Upload ── */}
        <div className="p-3.5 bg-black/30 border border-game-border/70 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📸</span>
              <div>
                <span className="text-xs font-bold text-white">
                  Tự Động Tính Tăng Tốc (Universal, Training, Healing) Bằng Ảnh
                </span>
                <p className="text-[11px] text-gray-400">
                  Kéo thả hoặc click chọn 2 ảnh 'TÀI NGUYÊN & TĂNG TỐC' Trước và Sau khi cày
                </p>
              </div>
            </div>
            {speedupBeforeData && speedupAfterData && (
              <span className="text-xs font-bold text-game-success bg-game-success/15 px-2 py-0.5 rounded-full border border-game-success/30 flex items-center gap-1">
                ✓ Đã tự động tính xong
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Before Speedup dropzone */}
            <div
              onClick={() => !isScanningBefore && beforeInputRef.current?.click()}
              className={`p-3 rounded-xl border border-dashed cursor-pointer transition-all flex items-center gap-3 ${
                beforePreviewUrl
                  ? 'bg-game-accent/10 border-game-accent/50'
                  : 'bg-black/20 border-game-border hover:border-gray-500'
              }`}
            >
              {beforePreviewUrl ? (
                <img
                  src={beforePreviewUrl}
                  alt="Tăng tốc trước"
                  className="w-12 h-12 object-cover rounded-lg border border-game-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-black/40 flex items-center justify-center text-xl">
                  📷
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {isScanningBefore
                    ? '⏳ Đang quét AI...'
                    : speedupBeforeData
                    ? '✓ Tăng Tốc Trước (Đã đọc)'
                    : 'Thêm ảnh Tăng Tốc TRƯỚC'}
                </div>
                <div className="text-[11px] text-gray-400 truncate">
                  {speedupBeforeData
                    ? `Uni: ${speedupBeforeData.universal.rawStr}`
                    : 'Click để chọn hoặc dán ảnh'}
                </div>
              </div>
              <input
                ref={beforeInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBeforeFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* After Speedup dropzone */}
            <div
              onClick={() => !isScanningAfter && afterInputRef.current?.click()}
              className={`p-3 rounded-xl border border-dashed cursor-pointer transition-all flex items-center gap-3 ${
                afterPreviewUrl
                  ? 'bg-game-accent/10 border-game-accent/50'
                  : 'bg-black/20 border-game-border hover:border-gray-500'
              }`}
            >
              {afterPreviewUrl ? (
                <img
                  src={afterPreviewUrl}
                  alt="Tăng tốc sau"
                  className="w-12 h-12 object-cover rounded-lg border border-game-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-black/40 flex items-center justify-center text-xl">
                  📷
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {isScanningAfter
                    ? '⏳ Đang quét AI...'
                    : speedupAfterData
                    ? '✓ Tăng Tốc Sau (Đã đọc)'
                    : 'Thêm ảnh Tăng Tốc SAU'}
                </div>
                <div className="text-[11px] text-gray-400 truncate">
                  {speedupAfterData
                    ? `Uni: ${speedupAfterData.universal.rawStr}`
                    : 'Click để chọn hoặc dán ảnh'}
                </div>
              </div>
              <input
                ref={afterInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAfterFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {speedupScanError && (
            <p className="text-xs text-red-400 font-mono mt-1">{speedupScanError}</p>
          )}
        </div>

        {/* ── Main Inputs Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* Account (Auto from Honor board or custom edit) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-400 font-semibold">Tên Account (Lấy từ Bảng Danh Dự)</label>
              {scannedAccount && (
                <span className="text-[10px] text-game-accent bg-game-accent/20 px-1.5 py-0.5 rounded font-mono">
                  Auto: {scannedAccount}
                </span>
              )}
            </div>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="ThatMofoKyle(Loki)"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Pilot (Self-entered) */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">Tên Pilot (Tự điền · Tự lưu)</label>
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
            <label className="block text-gray-400 mb-1 font-semibold">Ngày tháng ca cày (Time)</label>
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
            <label className="block text-gray-400 mb-1 font-semibold">Số giờ cày (Hours · Tự thêm)</label>
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

          {/* Universal speed (Auto from photos or manual) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-400 font-semibold">⏱️ Universal speed (Tăng tốc chung)</label>
              {speedupBeforeData && speedupAfterData && (
                <span className="text-[10px] text-game-success font-mono font-semibold">Tự tính từ ảnh</span>
              )}
            </div>
            <input
              type="text"
              value={universalSpeed}
              onChange={(e) => setUniversalSpeed(e.target.value)}
              placeholder="+5d 22h 25m"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Training speed (Auto from photos or manual) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-400 font-semibold">🏹 Training speed (Tăng tốc lính)</label>
              {speedupBeforeData && speedupAfterData && (
                <span className="text-[10px] text-game-success font-mono font-semibold">Tự tính từ ảnh</span>
              )}
            </div>
            <input
              type="text"
              value={trainingSpeed}
              onChange={(e) => setTrainingSpeed(e.target.value)}
              placeholder="+16d 20h 30m"
              className="w-full bg-black/40 border border-game-border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-game-accent"
            />
          </div>

          {/* Healing speed (Auto from photos or manual) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-400 font-semibold">🩹 Healing speed (Tăng tốc viện)</label>
              {speedupBeforeData && speedupAfterData && (
                <span className="text-[10px] text-game-success font-mono font-semibold">Tự tính từ ảnh</span>
              )}
            </div>
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

        {/* ── Live Preview Box ── */}
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

        {/* ── Footer Actions ── */}
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