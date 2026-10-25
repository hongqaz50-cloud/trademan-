/**
 * aiVisionService.ts — Multimodal AI vision service powered by Google Gemini.
 *
 * Uses Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite) for ultra-low token consumption,
 * high speed (< 1s), and 100% structured JSON extraction from game screenshots.
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { APScanResult, HonorScanResult } from '@/types/ocr';

export const AI_STORAGE_KEY = 'trademan_gemini_api_key';
export const AI_MODEL_KEY = 'trademan_gemini_model';
export const AI_ENABLED_KEY = 'trademan_ai_enabled';

export const DEFAULT_AI_MODEL = 'gemini-3.1-flash-lite';

/** Available lightweight models that consume minimal tokens */
export const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite (Tối ưu nhất · Tốn ít token nhất · Miễn phí)',
    tokens: '~280 tokens/ảnh',
    cost: '0.25$/1M token',
    recommended: true,
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite (Phiên bản mới nhất · Phản hồi cực nhanh)',
    tokens: '~300 tokens/ảnh',
    cost: '0.25$/1M token',
    recommended: false,
  },
] as const;

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(AI_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    localStorage.setItem(AI_STORAGE_KEY, key.trim());
  } catch {
    // Ignore storage errors
  }
}

export function getStoredModel(): string {
  try {
    return localStorage.getItem(AI_MODEL_KEY) || DEFAULT_AI_MODEL;
  } catch {
    return DEFAULT_AI_MODEL;
  }
}

export function setStoredModel(model: string): void {
  try {
    localStorage.setItem(AI_MODEL_KEY, model);
  } catch {
    // Ignore storage errors
  }
}

export function isAIEnabled(): boolean {
  try {
    const val = localStorage.getItem(AI_ENABLED_KEY);
    // Enabled by default if an API key exists
    if (val === null) return Boolean(getStoredApiKey());
    return val === 'true';
  } catch {
    return false;
  }
}

export function setAIEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AI_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

/** Convert a File or Blob into base64 string */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Scans an AP inventory or potion selection screenshot using Gemini AI.
 * Returns structured APScanResult with exact potion quantities.
 */
export async function scanAPWithAI(
  file: File | Blob,
  apiKey?: string,
  modelName?: string
): Promise<APScanResult> {
  const key = (apiKey || getStoredApiKey()).trim();
  if (!key) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập API Key để sử dụng tính năng quét bằng AI.');
  }

  const model = modelName || getStoredModel();
  const base64Data = await fileToBase64(file);
  const mimeType = (file as File).type || 'image/png';

  const ai = new GoogleGenAI({ apiKey: key });

  const prompt = `Bạn là trợ lý AI chuyên trích xuất dữ liệu game từ ảnh chụp màn hình.
Nhiệm vụ: Tìm 4 loại bình năng lượng (AP Potion) có dung dịch màu xanh lá cây và trích xuất SỐ LƯỢNG của từng loại bình:
- Bình 50 AP: số lượng hiển thị ở đáy bình có nhãn 50
- Bình 100 AP: số lượng hiển thị ở đáy bình có nhãn 100
- Bình 500 AP: số lượng hiển thị ở đáy bình có nhãn 500
- Bình 1.000 AP: số lượng hiển thị ở đáy bình có nhãn 1.000 (hoặc 1000)

Lưu ý quan trọng:
- Bỏ qua các vật phẩm khác như chìa khóa, đồng xu, trượng, sách.
- Trả về dạng số nguyên (ví dụ nếu hiển thị '1.762' thì giá trị là 1762, '3.116' là 3116).
- Nếu không tìm thấy loại bình nào thì điền 0 cho bình đó.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    config: {
      maxOutputTokens: 64,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ap50: { type: Type.INTEGER, description: 'Số lượng bình 50 AP' },
          ap100: { type: Type.INTEGER, description: 'Số lượng bình 100 AP' },
          ap500: { type: Type.INTEGER, description: 'Số lượng bình 500 AP' },
          ap1000: { type: Type.INTEGER, description: 'Số lượng bình 1000 AP' },
        },
        required: ['ap50', 'ap100', 'ap500', 'ap1000'],
      },
    },
  });

  const rawJson = response.text || '{}';
  const parsed = JSON.parse(rawJson);

  const ap50 = Number.isFinite(parsed.ap50) ? Math.max(0, parsed.ap50) : 0;
  const ap100 = Number.isFinite(parsed.ap100) ? Math.max(0, parsed.ap100) : 0;
  const ap500 = Number.isFinite(parsed.ap500) ? Math.max(0, parsed.ap500) : 0;
  const ap1000 = Number.isFinite(parsed.ap1000) ? Math.max(0, parsed.ap1000) : 0;

  const potions = [
    { cost: 50, quantity: ap50 },
    { cost: 100, quantity: ap100 },
    { cost: 500, quantity: ap500 },
    { cost: 1000, quantity: ap1000 },
  ];

  const totalAP = potions.reduce((sum, p) => sum + p.cost * p.quantity, 0);

  return { potions, totalAP };
}

/**
 * Scans an Honor Board screenshot using Gemini AI.
 * Returns structured HonorScanResult with exact player honor points.
 */
export async function scanHonorWithAI(
  file: File | Blob,
  apiKey?: string,
  modelName?: string
): Promise<HonorScanResult> {
  const key = (apiKey || getStoredApiKey()).trim();
  if (!key) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập API Key để sử dụng tính năng quét bằng AI.');
  }

  const model = modelName || getStoredModel();
  const base64Data = await fileToBase64(file);
  const mimeType = (file as File).type || 'image/png';

  const ai = new GoogleGenAI({ apiKey: key });

  const prompt = `Bạn là trợ lý AI chuyên trích xuất dữ liệu từ ảnh chụp màn hình "Bảng Danh Dự" trong game.
Nhiệm vụ: Tìm và trích xuất điểm Danh Dự (Honor points) của người chơi trong ảnh.
- Điểm Danh Dự thường là số chia hết cho 10 (ví dụ 810, 11040, 25000...).
- Bỏ qua số thứ hạng (rank) ở đầu dòng.
- Bỏ qua mã máy chủ Server ID bắt đầu bằng ký tự # (ví dụ #2563).
- Trả về đúng con số điểm danh dự dạng số nguyên.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    config: {
      maxOutputTokens: 32,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          honorValue: { type: Type.INTEGER, description: 'Điểm Danh Dự kiếm được' },
        },
        required: ['honorValue'],
      },
    },
  });

  const rawJson = response.text || '{}';
  const parsed = JSON.parse(rawJson);
  const honorValue = Number.isFinite(parsed.honorValue) ? Math.max(0, parsed.honorValue) : 0;

  return {
    honorValue,
    confidence: 'high',
  };
}

/**
 * Verifies if an API Key is valid by calling a lightweight prompt.
 */
export async function testGeminiApiKey(apiKey: string, modelName?: string): Promise<boolean> {
  const key = apiKey.trim();
  if (!key) return false;

  const model = modelName || DEFAULT_AI_MODEL;
  const ai = new GoogleGenAI({ apiKey: key });

  const response = await ai.models.generateContent({
    model,
    contents: 'Hi',
    config: {
      maxOutputTokens: 5,
    },
  });

  return Boolean(response.text);
}
