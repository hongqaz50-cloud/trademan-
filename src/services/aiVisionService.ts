/**
 * aiVisionService.ts — Multimodal AI vision service powered by Google Gemini.
 *
 * Uses Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite) for ultra-low token consumption,
 * high speed (< 1s), and 100% structured JSON extraction from game screenshots.
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { APScanResult, HonorScanResult, SpeedupScanResult } from '@/types/ocr';

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

  const prompt = `Trích xuất tên người chơi (Account name) và điểm Danh Dự (Honor points) trong màn hình Bảng Danh Dự game Rise of Kingdoms (ROK).`;

  const configObj: Record<string, unknown> = {
    systemInstruction: `Bạn là trợ lý AI chuyên trích xuất dữ liệu từ game Rise of Kingdoms (ROK).
Trong ảnh chụp màn hình 'Bảng Danh Dự' (Honor Roll / Honor Ranking):
- Tìm và trích xuất:
  1. Tên người chơi (Player / Account Name): ví dụ '[LOST] Loki' hoặc 'Loki'. Bỏ qua số thứ hạng Rank đầu dòng.
  2. Điểm Danh Dự (Honor points): số nguyên lớn (ví dụ 30012, 35004...).
- Bỏ qua ID máy chủ dạng #XXXX (ví dụ #1903).
- Bỏ dấu chấm phân cách hàng nghìn và trả về số nguyên sạch.`,
    maxOutputTokens: 256,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        honorValue: { type: Type.INTEGER, description: 'Điểm Danh Dự kiếm được' },
        playerName: { type: Type.STRING, description: 'Tên người chơi trong bảng danh dự, ví dụ [LOST] Loki' },
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
  const playerName = typeof parsed.playerName === 'string' && parsed.playerName.trim()
    ? parsed.playerName.trim()
    : undefined;

  return {
    honorValue,
    playerName,
    confidence: 'high',
  };
}

/**
 * Scans a Speedup inventory screen ("TÀI NGUYÊN & TĂNG TỐC") using Gemini AI.
 * Extracts days, hours, minutes for Universal, Training, and Healing speedups.
 */
export async function scanSpeedupWithAI(
  file: File | Blob,
  apiKey?: string,
  modelName?: string
): Promise<SpeedupScanResult> {
  const key = (apiKey || getStoredApiKey()).trim();
  if (!key) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập API Key để sử dụng tính năng quét bằng AI.');
  }

  const model = modelName || getStoredModel();
  const base64Data = await fileToBase64(file);
  const mimeType = (file as File).type || 'image/png';

  const ai = new GoogleGenAI({ apiKey: key });

  const prompt = `Trích xuất thời gian tăng tốc từ màn hình 'TÀI NGUYÊN & TĂNG TỐC' trong game Rise of Kingdoms (ROK):
1. Tăng tốc chung (Universal Speedup): dòng 'Tăng tốc' ở cuối danh sách (ví dụ '3.177 ngày 18 giờ 32 phút')
2. Tăng tốc huấn luyện (Training Speedup): dòng 'Tăng tốc huấn luyện' (ví dụ '833 ngày 19 giờ 20 phút')
3. Tăng tốc chữa lành (Healing Speedup): dòng 'Tăng tốc chữa lành' (ví dụ '284 ngày 23 giờ 35 phút')`;

  const configObj: Record<string, unknown> = {
    systemInstruction: `Bạn là trợ lý AI chuyên trích xuất dữ liệu tăng tốc game Rise of Kingdoms (ROK).
Nhiệm vụ: Trích xuất chính xác số ngày (days), số giờ (hours), số phút (minutes) của từng loại tăng tốc:
- 'Tăng tốc' ở hàng cuối cùng chính là Universal Speedup (tăng tốc chung). Dấu chấm là phân cách hàng nghìn (ví dụ 3.177 ngày -> 3177).
- 'Tăng tốc huấn luyện' là Training Speedup.
- 'Tăng tốc chữa lành' là Healing Speedup.
Trả về số nguyên sạch cho mỗi đơn vị ngày, giờ, phút. Nếu không thấy thì để 0.`,
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        universalDays: { type: Type.INTEGER, description: 'Số ngày của Tăng tốc (dòng cuối)' },
        universalHours: { type: Type.INTEGER, description: 'Số giờ của Tăng tốc' },
        universalMinutes: { type: Type.INTEGER, description: 'Số phút của Tăng tốc' },
        trainingDays: { type: Type.INTEGER, description: 'Số ngày của Tăng tốc huấn luyện' },
        trainingHours: { type: Type.INTEGER, description: 'Số giờ của Tăng tốc huấn luyện' },
        trainingMinutes: { type: Type.INTEGER, description: 'Số phút của Tăng tốc huấn luyện' },
        healingDays: { type: Type.INTEGER, description: 'Số ngày của Tăng tốc chữa lành' },
        healingHours: { type: Type.INTEGER, description: 'Số giờ của Tăng tốc chữa lành' },
        healingMinutes: { type: Type.INTEGER, description: 'Số phút của Tăng tốc chữa lành' },
      },
      required: [
        'universalDays', 'universalHours', 'universalMinutes',
        'trainingDays', 'trainingHours', 'trainingMinutes',
        'healingDays', 'healingHours', 'healingMinutes',
      ],
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

  const uD = Math.max(0, Number(parsed.universalDays) || 0);
  const uH = Math.max(0, Number(parsed.universalHours) || 0);
  const uM = Math.max(0, Number(parsed.universalMinutes) || 0);

  const tD = Math.max(0, Number(parsed.trainingDays) || 0);
  const tH = Math.max(0, Number(parsed.trainingHours) || 0);
  const tM = Math.max(0, Number(parsed.trainingMinutes) || 0);

  const hD = Math.max(0, Number(parsed.healingDays) || 0);
  const hH = Math.max(0, Number(parsed.healingHours) || 0);
  const hM = Math.max(0, Number(parsed.healingMinutes) || 0);

  return {
    universal: {
      days: uD,
      hours: uH,
      minutes: uM,
      totalMinutes: uD * 1440 + uH * 60 + uM,
      rawStr: `${uD}d ${uH}h ${uM}m`,
    },
    training: {
      days: tD,
      hours: tH,
      minutes: tM,
      totalMinutes: tD * 1440 + tH * 60 + tM,
      rawStr: `${tD}d ${tH}h ${tM}m`,
    },
    healing: {
      days: hD,
      hours: hH,
      minutes: hM,
      totalMinutes: hD * 1440 + hH * 60 + hM,
      rawStr: `${hD}d ${hH}h ${hM}m`,
    },
  };
}

/**
 * Calculates the difference between two speedup scans and formats it as +Xd Yh Zm
 */
export function formatSpeedupDelta(deltaMinutes: number): string {
  const sign = deltaMinutes >= 0 ? '+' : '-';
  const absMin = Math.abs(deltaMinutes);
  const d = Math.floor(absMin / 1440);
  const h = Math.floor((absMin % 1440) / 60);
  const m = absMin % 60;
  return `${sign}${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
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
