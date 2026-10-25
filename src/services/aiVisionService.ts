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
    label: 'Gemini 3.1 Flash-Lite (Tốn ít token nhất · ~280 tokens · Khuyên dùng)',
    tokens: '~280 tokens/ảnh',
    cost: '0.25$/1M token',
    recommended: true,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Tương thích phổ biến cao nhất)',
    tokens: '~350 tokens/ảnh',
    cost: 'Tiêu chuẩn',
    recommended: false,
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite (Phiên bản mới nhất)',
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

  const prompt = `Trích xuất số lượng của 4 loại bình AP màu xanh lá cây trong game Rise of Kingdoms (ROK): ap50, ap100, ap500, ap1000.`;

  const configObj: Record<string, unknown> = {
    systemInstruction: `Bạn là trợ lý AI chuyên nhận diện vật phẩm trong game Rise of Kingdoms (ROK).
Quy tắc nhận dạng bình hồi phục AP (Action Point / Điểm Hành Động):
1. ĐẶC ĐIỂM BÌNH AP: Là bình thủy tinh chứa DUNG DỊCH MÀU XANH LÁ CÂY (green potion liquid), miệng bình thắt dây đỏ có gắn thẻ cam.
2. 4 LOẠI BÌNH AP (nhãn số ghi ở MẶT TRÊN của mỗi ô vật phẩm):
   - 50 AP: Nhãn trên ghi '50' (thẻ viền vàng nền xanh lá)
   - 100 AP: Nhãn trên ghi '100' (thẻ viền vàng nền xanh lá)
   - 500 AP: Nhãn trên ghi '500' (thẻ viền vàng nền xanh lam)
   - 1000 AP: Nhãn trên ghi '1.000' hoặc '1000' (thẻ viền vàng nền tím)
3. SỐ LƯỢNG SỞ HỮU: Là con số hiển thị ở GÓC DƯỚI CÙNG của từng bình AP đó.
   - Dấu chấm '.' là dấu phân cách hàng nghìn trong game ROK (ví dụ '1.762' -> 1762, '3.116' -> 3116, '1.065' -> 1065, '38' -> 38, '10' -> 10). Bỏ dấu chấm và trả về số nguyên sạch.
4. BỎ QUA TẤT CẢ VẬT PHẨM KHÁC TRONG TÚI ĐỒ:
   - Bỏ qua chìa khóa vàng, chìa khóa bạc, đồng xu vàng có hình chìa khóa, huy hiệu di chuyển, sách bìa đỏ (2024, 2025, 2026), trượng, rương, v.v.
   - CHỈ TẬP TRUNG VÀO CÁC Ô CÓ HÌNH BÌNH NƯỚC XANH LÁ CÂY.
5. VỊ TRÍ: Bình AP có thể nằm rải rác ở bất kỳ hàng nào (hàng trên, hàng dưới, các cột khác nhau) trong kho túi đồ. Quét toàn bộ ảnh. Nếu loại bình nào không có trong ảnh thì điền 0.`,
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        ap50: { type: Type.INTEGER, description: 'Số lượng bình 50 AP (dung dịch xanh lá, nhãn trên 50)' },
        ap100: { type: Type.INTEGER, description: 'Số lượng bình 100 AP (dung dịch xanh lá, nhãn trên 100)' },
        ap500: { type: Type.INTEGER, description: 'Số lượng bình 500 AP (dung dịch xanh lá, nhãn trên 500)' },
        ap1000: { type: Type.INTEGER, description: 'Số lượng bình 1000 AP (dung dịch xanh lá, nhãn trên 1.000)' },
      },
      required: ['ap50', 'ap100', 'ap500', 'ap1000'],
    },
  };

  const contents = [
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    prompt,
  ];

  let response;
  try {
    // Attempt with thinkingBudget: 0 for minimal token cost and instant output
    response = await ai.models.generateContent({
      model,
      contents,
      config: {
        ...configObj,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });
  } catch {
    // If model does not support thinkingBudget, retry with standard config
    response = await ai.models.generateContent({
      model,
      contents,
      config: configObj,
    });
  }

  let rawJson = (response.text || '{}').trim();
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
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

  const prompt = `Trích xuất điểm Danh Dự (Honor points) của người chơi trong màn hình Bảng Danh Dự game Rise of Kingdoms (ROK).`;

  const configObj: Record<string, unknown> = {
    systemInstruction: `Bạn là trợ lý AI chuyên trích xuất dữ liệu từ game Rise of Kingdoms (ROK).
Trong ảnh chụp màn hình 'Bảng Danh Dự' (Honor Roll / Honor Ranking):
- Tìm và trích xuất điểm Danh Dự (Honor points) của người chơi.
- Điểm Danh Dự thường là số nguyên lớn (ví dụ 810, 11040, 25000...).
- Bỏ qua số thứ hạng Rank (1, 2, 3...) ở cột bên trái.
- Bỏ qua ID máy chủ dạng #XXXX (ví dụ #2563).
- Bỏ dấu chấm phân cách hàng nghìn và trả về số nguyên sạch.`,
    maxOutputTokens: 256,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        honorValue: { type: Type.INTEGER, description: 'Điểm Danh Dự kiếm được' },
      },
      required: ['honorValue'],
    },
  };

  const contents = [
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    prompt,
  ];

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents,
      config: {
        ...configObj,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });
  } catch {
    response = await ai.models.generateContent({
      model,
      contents,
      config: configObj,
    });
  }

  let rawJson = (response.text || '{}').trim();
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const parsed = JSON.parse(rawJson);
  const honorValue = Number.isFinite(parsed.honorValue) ? Math.max(0, parsed.honorValue) : 0;

  return {
    honorValue,
    confidence: 'high',
  };
}

/**
 * Verifies if an API Key is valid by calling a lightweight prompt.
 * Returns detailed status and error message if connection fails.
 */
export async function testGeminiApiKey(
  apiKey: string,
  modelName?: string
): Promise<{ success: boolean; error?: string }> {
  const key = apiKey.trim();
  if (!key) return { success: false, error: 'Chưa nhập API Key' };

  try {
    const model = modelName || getStoredModel();
    const ai = new GoogleGenAI({ apiKey: key });

    const response = await ai.models.generateContent({
      model,
      contents: 'Ping',
      config: {
        maxOutputTokens: 20,
      },
    });

    if (response.text) {
      return { success: true };
    }
    return { success: false, error: 'Không nhận được dữ liệu từ API Google' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
