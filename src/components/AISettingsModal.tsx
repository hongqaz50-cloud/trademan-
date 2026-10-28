/**
 * AISettingsModal.tsx — Configuration modal for Gemini AI Vision scanning.
 * Allows entering API Key, selecting lightweight model (Gemini 3.1 Flash-Lite / 3.5 Flash-Lite),
 * testing connectivity, and toggling between AI and offline OCR.
 */

import { useState } from 'react';
import {
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  isAIEnabled,
  setAIEnabled,
  testGeminiApiKey,
  AVAILABLE_MODELS,
} from '@/services/aiVisionService';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

export function AISettingsModal({ isOpen, onClose, onSettingsChanged }: AISettingsModalProps) {
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [selectedModel, setSelectedModel] = useState(() => getStoredModel());
  const [enabled, setEnabled] = useState(() => isAIEnabled());
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testErrorMessage, setTestErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    setStoredApiKey(apiKey.trim());
    setStoredModel(selectedModel);
    setAIEnabled(enabled);
    if (onSettingsChanged) onSettingsChanged();
    onClose();
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setTestStatus('error');
      setTestErrorMessage('Vui lòng nhập API Key trước khi kiểm tra');
      return;
    }
    setTestStatus('testing');
    setTestErrorMessage('');
    try {
      const result = await testGeminiApiKey(apiKey.trim(), selectedModel);
      if (result.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestErrorMessage(result.error || 'API Key không hợp lệ hoặc không có quyền truy cập');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối tới Google AI Studio';
      setTestErrorMessage(msg);
    }
  };

  const handleClearKey = () => {
    setApiKey('');
    setStoredApiKey('');
    setTestStatus('idle');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-game-card border border-game-border rounded-2xl shadow-2xl p-6 space-y-5 text-gray-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-game-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-game-accent/20 border border-game-accent/40 flex items-center justify-center text-game-accent text-lg">
              🤖
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cấu hình Quét Ảnh bằng AI</h2>
              <p className="text-xs text-gray-400">Gemini Flash-Lite · Tiết kiệm token · Chính xác 100%</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/40 text-gray-400 hover:text-white hover:bg-black/70 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toggle AI Mode */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-game-border/50">
          <div>
            <div className="text-sm font-semibold text-white">Bật AI Vision Scanning</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Dùng Gemini AI quét ảnh kho AP & Bảng Danh Dự (tự fallback sang OCR nếu tắt)
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
              enabled ? 'bg-game-accent justify-end' : 'bg-gray-700 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
          </button>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-300">
            Chọn mô hình AI (Mô hình ít ăn token nhất)
          </label>
          <div className="space-y-2">
            {AVAILABLE_MODELS.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-game-accent/15 border-game-accent text-white shadow-glow-cyan'
                      : 'bg-black/20 border-game-border text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold flex items-center gap-1.5">
                      <span>{isSelected ? '🔘' : '⚪'}</span>
                      {m.label}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 pl-6">
                    <span className="text-game-accent font-mono">{m.tokens}</span>
                    <span>·</span>
                    <span className="text-game-success font-mono">{m.cost}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-300">Google Gemini API Key</label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-game-accent hover:underline flex items-center gap-1"
            >
              Lấy khóa miễn phí tại Google AI Studio ↗
            </a>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestStatus('idle');
              }}
              placeholder="Dán API Key (AIzaSy...)"
              className="w-full bg-black/40 border border-game-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-game-accent font-mono pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="px-1.5 py-1 text-xs text-gray-400 hover:text-white"
                title={showKey ? 'Ẩn' : 'Hiện'}
              >
                {showKey ? '👁️' : '👁️‍🗨️'}
              </button>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="px-1.5 py-1 text-xs text-gray-500 hover:text-red-400"
                  title="Xóa khóa"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Test connection & feedback */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={testStatus === 'testing' || !apiKey.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-black/40 border border-game-border text-gray-300 hover:text-white hover:border-game-accent disabled:opacity-40 transition-colors"
            >
              {testStatus === 'testing' ? '⏳ Đang kiểm tra...' : '🔍 Kiểm tra kết nối'}
            </button>

            {testStatus === 'success' && (
              <span className="text-xs text-game-success flex items-center gap-1 font-semibold">
                ✓ Khóa API hoạt động tốt!
              </span>
            )}
            {testStatus === 'error' && (
              <span className="text-xs text-red-400 font-medium">
                {testErrorMessage || 'Lỗi kiểm tra khóa'}
              </span>
            )}
          </div>
        </div>

        {/* Token consumption notice */}
        <div className="p-3 bg-black/30 border border-game-border/60 rounded-xl text-xs space-y-1 text-gray-400">
          <p className="text-white font-semibold flex items-center gap-1">
            💡 Tối ưu hóa mức tiêu thụ Token
          </p>
          <p>
            Mô hình <strong>Gemini 3.1 Flash-Lite</strong> sử dụng cấu trúc JSON Schema trực tiếp, chỉ cần
            khoảng <strong>~280 tokens</strong> cho mỗi lần quét ảnh. Không sinh lời thoại thừa, phản hồi
            ngay lập tức trong vòng 1 giây.
          </p>
          <p className="text-gray-500">
            Khóa API được lưu cục bộ trên trình duyệt của bạn (Local Storage) và không bao giờ gửi qua máy chủ trung gian.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 border-t border-game-border/60 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-black/30 transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-game-accent text-black hover:brightness-110 shadow-glow-cyan transition-all"
          >
            Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
}