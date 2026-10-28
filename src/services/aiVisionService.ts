/**
 * aiVisionService.ts — Multimodal AI vision service powered by Google Gemini.
 *
 * Uses Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite) for ultra-low token consumption,
 * high speed (< 1s), and 100% structured JSON extraction from game screenshots.
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { APScanResult, HonorScanResult, SpeedupScanResult, BatchScanResult, SmartScanResult } from '@/types/ocr';

export const AI_STORAGE_KEY = 'trademan_gemini_api_key';
export const AI_MODEL_KEY = 'trademan_gemini_model';
export const AI_ENABLED_KEY = 'trademan_ai_enabled';

export const DEFAULT_AI_MODEL = 'gemini-3.5-flash-lite';

/** Available lightweight models that consume minimal tokens */
export const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite (Tốc độ cao nhất · Rẻ nhất · Khuyên dùng)',
    tokens: '~280 tokens/ảnh',
    cost: '0.25$/1M token',
    recommended: true,
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash (Độ chính xác cao)',
    tokens: '~350 tokens/ảnh',
    cost: 'Tiêu chuẩn',
    recommended: false,
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash (Phiên bản mới nhất)',
    tokens: '~350 tokens/ảnh',
    cost: 'Tiêu chuẩn',
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
 * Robustly parses an honor points value from Gemini output.
 * Handles integer (35004), string with dots/commas ("35.004", "35,004"),
 * float (35.004 -> 35004), or formatted string ("35.004 Điểm").
 */
export function parseHonorValue(val: unknown): number {
  if (val === null || val === undefined) return 0;

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 0;
    // If Gemini returned a float like 35.004 (where . was treated as decimal dot)
    if (val > 0 && val < 1000 && !Number.isInteger(val)) {
      return Math.round(val * 1000);
    }
    return Math.max(0, Math.round(val));
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    // Extract first group of digits, dots, commas
    const match = trimmed.match(/[\d\.,\s]+/);
    if (!match) return 0;
    const cleanStr = match[0].replace(/[\.,\s]/g, '');
    const num = parseInt(cleanStr, 10);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
  }

  return 0;
}

/** Helper to apply model-appropriate thinking configuration without errors */
function getModelConfig(model: string, baseConfig: Record<string, unknown>): Record<string, unknown> {
  if (model.includes('2.5')) {
    return {
      ...baseConfig,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    };
  }
  if (model.includes('gemini-3')) {
    return {
      ...baseConfig,
      thinkingConfig: {
        thinkingLevel: 'minimal',
      },
    };
  }
  return baseConfig;
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

  const prompt = `Trích xuất tên người chơi (playerName) và điểm Danh Dự (honorValue) trong màn hình Bảng Danh Dự game Rise of Kingdoms (ROK):
1. Tên người chơi (playerName): nằm sau avatar, ví dụ '[LOST] Loki'. Giữ nguyên tag liên minh trong ngoặc vuông nếu có. Bỏ qua số thứ hạng rank đầu dòng và bỏ qua mã vương quốc #XXXX.
2. Điểm Danh Dự (honorValue): LÀ CON SỐ NẰM Ở NGOÀI CÙNG BÊN PHẢI (FAR-RIGHT) CỦA THANH RUY-BĂNG (ví dụ: '35.004', '30.012', '125.800'). BẮT BUỘC TRÍCH XUẤT CON SỐ NGOÀI CÙNG BÊN PHẢI NÀY và trả về dạng chuỗi ví dụ "35.004".`;

  const configObj: Record<string, unknown> = {
    systemInstruction: `Bạn là trợ lý AI chuyên trích xuất dữ liệu từ game Rise of Kingdoms (ROK).
Trong ảnh chụp màn hình 'Bảng Danh Dự' (Honor Roll / Honor Ranking):
CẤU TRÚC THANH NGƯỜI CHƠI (từ Trái sang Phải):
1. Số thứ hạng Rank đầu tiên bên trái (ví dụ '201', '1', '2') -> BỎ QUA, KHÔNG LẤY LÀM ĐIỂM!
2. Biểu tượng Avatar -> BỎ QUA.
3. Tên người chơi (playerName): nằm ngay sau Avatar (ví dụ '[LOST] Loki'). Giữ nguyên tag liên minh nếu có.
4. Mã vương quốc dạng #XXXX (ví dụ #1903) -> BỎ QUA.
5. ĐIỂM DANH DỰ (honorValue): LÀ CON SỐ NẰM Ở NGOÀI CÙNG BÊN PHẢI CỦA THANH RUY-BĂNG (ví dụ '35.004', '30.012').
BẮT BUỘC trích xuất con số ở góc ngoài cùng bên phải này và gán vào honorValue dạng chuỗi!`,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        honorValue: { type: Type.STRING, description: 'Điểm Danh Dự ở ngoài cùng bên phải dải ruy-băng người chơi (ví dụ: "35.004" hoặc "35004")' },
        playerName: { type: Type.STRING, description: 'Tên người chơi trong bảng danh dự, ví dụ [LOST] Loki' },
      },
      required: ['honorValue', 'playerName'],
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
      config: getModelConfig(model, configObj),
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

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    console.warn('JSON parse fallback for honor:', rawJson);
  }

  const rawHonor = parsed.honorValue ?? parsed.honor ?? parsed.honorPoints ?? parsed.points ?? parsed.score;
  let honorValue = parseHonorValue(rawHonor);

  // Safeguard: If honorValue is 0, extract ROK honor score pattern XX.XXX from raw response text
  if (honorValue === 0) {
    const match = rawJson.match(/\b(\d{1,3}[\.,]\d{3}(?:[\.,]\d{3})?)\b/);
    if (match) {
      honorValue = parseHonorValue(match[1]);
    }
  }

  let playerName = typeof parsed.playerName === 'string' && parsed.playerName.trim()
    ? parsed.playerName.trim()
    : undefined;

  if (!playerName) {
    const pMatch = rawJson.match(/"playerName"\s*:\s*"([^"]+)"/);
    if (pMatch) playerName = pMatch[1].trim();
  }

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
 * Scans a batch of up to 3 screenshots (Honor board, AP inventory, Speedups) in a single multimodal API call.
 * Automatically classifies each screenshot and extracts AP, Honor, and Speedup metrics simultaneously.
 */
export async function scanBatchScreenshotsWithAI(
  files: (File | Blob)[],
  apiKey?: string,
  modelName?: string
): Promise<BatchScanResult> {
  const key = (apiKey || getStoredApiKey()).trim();
  if (!key) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập API Key để sử dụng tính năng quét bằng AI.');
  }

  if (!files || files.length === 0) {
    throw new Error('Chưa chọn ảnh nào để quét.');
  }

  const model = modelName || getStoredModel();
  const ai = new GoogleGenAI({ apiKey: key });

  // Convert all files to inlineData parts
  const inlineParts = await Promise.all(
    files.map(async (file) => {
      const base64Data = await fileToBase64(file);
      const mimeType = (file as File).type || 'image/png';
      return {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };
    })
  );

  const prompt = `Bạn là trợ lý AI chuyên phân tích dữ liệu game Rise of Kingdoms (ROK) từ các ảnh chụp màn hình.
Bạn được cung cấp ${files.length} ảnh chụp màn hình (theo thứ tự gửi kèm: ảnh index 0, 1, 2).
HÃY PHÂN LOẠI CHÍNH XÁC TỪNG ẢNH VÀ TRÍCH XUẤT DỮ LIỆU:

1. XÁC ĐỊNH CHỈ SỐ ẢNH:
   - honorImageIndex: Chỉ số (0, 1, hoặc 2) của ảnh là 'BẢNG DANH DỰ' (Honor Roll).
   - apImageIndex: Chỉ số (0, 1, hoặc 2) của ảnh là 'KHO ĐỒ / TÚI ĐỒ' chứa BÌNH AP (Action Point).
   - speedupImageIndex: Chỉ số (0, 1, hoặc 2) của ảnh là 'TÀI NGUYÊN & TĂNG TỐC' (Speedups).

2. TRÍCH XUẤT TỪ ẢNH BẢNG DANH DỰ (Honor Roll):
   - Cấu trúc thanh người chơi: [Rank ví dụ 201] [Avatar] [Tên ví dụ [LOST] Loki] [#Vương quốc ví dụ #1903] [Điểm Danh Dự ở ngoài cùng bên phải ví dụ 35.004].
   - Tên người chơi (playerName): ví dụ '[LOST] Loki' (bỏ qua số thứ hạng rank đầu dòng và bỏ qua #1903).
   - Điểm Danh Dự (honorValue): LÀ CON SỐ NẰM Ở NGOÀI CÙNG BÊN PHẢI CỦA THANH RUY-BĂNG (ví dụ: '35.004', '30.012'). BẮT BUỘC TRÍCH XUẤT CON SỐ NGOÀI CÙNG NÀY dạng chuỗi ví dụ "35.004".

3. TRÍCH XUẤT TỪ ẢNH KHO BÌNH AP:
   - ĐẶC ĐIỂM: Chỉ nhận diện các ô chứa BÌNH THỦY TINH DUNG DỊCH MÀU XANH LÁ CÂY, nút thắt dây đỏ.
   - BỎ QUA tất cả các vật phẩm khác: chìa khóa, đồng xu vàng, token, sách, trượng...
   - Trích xuất số lượng của 4 loại bình: ap50, ap100, ap500, ap1000. Dấu chấm là phân cách hàng nghìn (ví dụ 1.065 -> 1065, 3.122 -> 3122).

4. TRÍCH XUẤT TỪ ẢNH KHO TĂNG TỐC:
   - Universal Speedup: dòng 'Tăng tốc' ở cuối danh sách -> universalDays, universalHours, universalMinutes.
   - Training Speedup: dòng 'Tăng tốc huấn luyện' -> trainingDays, trainingHours, trainingMinutes.
   - Healing Speedup: dòng 'Tăng tốc chữa lành' -> healingDays, healingHours, healingMinutes.
   
Nếu trong các ảnh không có ảnh của một loại nào thì điền 0 cho loại đó và -1 cho index.`;

  const configObj: Record<string, unknown> = {
    systemInstruction: `Bạn là trợ lý AI chuyên nhận diện dữ liệu game Rise of Kingdoms (ROK). Hãy phân tích toàn bộ các ảnh được gửi kèm, phân loại đúng chỉ số ảnh và trích xuất đúng cấu trúc JSON.`,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        // Image classification indices
        honorImageIndex: { type: Type.INTEGER, description: 'Chỉ số (0, 1, hoặc 2) của ảnh Bảng Danh Dự' },
        apImageIndex: { type: Type.INTEGER, description: 'Chỉ số (0, 1, hoặc 2) của ảnh Kho Bình AP' },
        speedupImageIndex: { type: Type.INTEGER, description: 'Chỉ số (0, 1, hoặc 2) của ảnh Kho Tăng Tốc' },
        // AP
        ap50: { type: Type.INTEGER, description: 'Số lượng bình 50 AP (dung dịch xanh lá)' },
        ap100: { type: Type.INTEGER, description: 'Số lượng bình 100 AP (dung dịch xanh lá)' },
        ap500: { type: Type.INTEGER, description: 'Số lượng bình 500 AP (dung dịch xanh lá)' },
        ap1000: { type: Type.INTEGER, description: 'Số lượng bình 1000 AP (dung dịch xanh lá)' },
        // Honor
        honorValue: { type: Type.STRING, description: 'Điểm Danh Dự ở ngoài cùng bên phải của thanh ruy-băng trong Bảng Danh Dự (ví dụ "35.004" hoặc "35004")' },
        playerName: { type: Type.STRING, description: 'Tên người chơi trong bảng danh dự, ví dụ [LOST] Loki' },
        // Speedups
        universalDays: { type: Type.INTEGER, description: 'Số ngày Tăng tốc (dòng cuối)' },
        universalHours: { type: Type.INTEGER, description: 'Số giờ Tăng tốc' },
        universalMinutes: { type: Type.INTEGER, description: 'Số phút Tăng tốc' },
        trainingDays: { type: Type.INTEGER, description: 'Số ngày Tăng tốc huấn luyện' },
        trainingHours: { type: Type.INTEGER, description: 'Số giờ Tăng tốc huấn luyện' },
        trainingMinutes: { type: Type.INTEGER, description: 'Số phút Tăng tốc huấn luyện' },
        healingDays: { type: Type.INTEGER, description: 'Số ngày Tăng tốc chữa lành' },
        healingHours: { type: Type.INTEGER, description: 'Số giờ Tăng tốc chữa lành' },
        healingMinutes: { type: Type.INTEGER, description: 'Số phút Tăng tốc chữa lành' },
      },
      required: [
        'honorImageIndex', 'apImageIndex', 'speedupImageIndex',
        'ap50', 'ap100', 'ap500', 'ap1000',
        'honorValue',
        'universalDays', 'universalHours', 'universalMinutes',
        'trainingDays', 'trainingHours', 'trainingMinutes',
        'healingDays', 'healingHours', 'healingMinutes',
      ],
    },
  };

  const contents = [...inlineParts, prompt];

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

  // Parse AP
  const ap50 = Math.max(0, Number(parsed.ap50) || 0);
  const ap100 = Math.max(0, Number(parsed.ap100) || 0);
  const ap500 = Math.max(0, Number(parsed.ap500) || 0);
  const ap1000 = Math.max(0, Number(parsed.ap1000) || 0);

  const potions = [
    { cost: 50, quantity: ap50 },
    { cost: 100, quantity: ap100 },
    { cost: 500, quantity: ap500 },
    { cost: 1000, quantity: ap1000 },
  ];
  const totalAP = potions.reduce((s, p) => s + p.cost * p.quantity, 0);

  // Parse Honor
  const honorValue = parseHonorValue(parsed.honorValue);
  const playerName = typeof parsed.playerName === 'string' && parsed.playerName.trim()
    ? parsed.playerName.trim()
    : undefined;

  // Parse Speedups
  const uD = Math.max(0, Number(parsed.universalDays) || 0);
  const uH = Math.max(0, Number(parsed.universalHours) || 0);
  const uM = Math.max(0, Number(parsed.universalMinutes) || 0);

  const tD = Math.max(0, Number(parsed.trainingDays) || 0);
  const tH = Math.max(0, Number(parsed.trainingHours) || 0);
  const tM = Math.max(0, Number(parsed.trainingMinutes) || 0);

  const hD = Math.max(0, Number(parsed.healingDays) || 0);
  const hH = Math.max(0, Number(parsed.healingHours) || 0);
  const hM = Math.max(0, Number(parsed.healingMinutes) || 0);

  const honorImageIndex = typeof parsed.honorImageIndex === 'number' ? parsed.honorImageIndex : 0;
  const apImageIndex = typeof parsed.apImageIndex === 'number' ? parsed.apImageIndex : 1;
  const speedupImageIndex = typeof parsed.speedupImageIndex === 'number' ? parsed.speedupImageIndex : 2;

  return {
    ap: { potions, totalAP },
    honor: { honorValue, playerName, confidence: 'high' },
    speedup: {
      universal: { days: uD, hours: uH, minutes: uM, totalMinutes: uD * 1440 + uH * 60 + uM, rawStr: `${uD}d ${uH}h ${uM}m` },
      training: { days: tD, hours: tH, minutes: tM, totalMinutes: tD * 1440 + tH * 60 + tM, rawStr: `${tD}d ${tH}h ${tM}m` },
      healing: { days: hD, hours: hH, minutes: hM, totalMinutes: hD * 1440 + hH * 60 + hM, rawStr: `${hD}d ${hH}h ${hM}m` },
    },
    honorImageIndex,
    apImageIndex,
    speedupImageIndex,
  };
}

/**
 * Scans a single screenshot of unknown type (Honor board, AP inventory, or Speedup inventory).
 * Automatically classifies the screenshot into 'honor', 'ap', or 'speedup' and extracts its data.
 */
export async function scanSmartScreenshotWithAI(
  file: File | Blob,
  apiKey?: string,
  modelName?: string
): Promise<SmartScanResult> {
  const key = (apiKey || getStoredApiKey()).trim();
  if (!key) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập API Key để quét ảnh.');
  }

  const model = modelName || getStoredModel();
  const base64Data = await fileToBase64(file);
  const mimeType = (file as File).type || 'image/png';
  const ai = new GoogleGenAI({ apiKey: key });

  const prompt = `Bạn là trợ lý AI chuyên phân tích ảnh chụp màn hình game Rise of Kingdoms (ROK).
Hãy xem ảnh này và xác định nó thuộc loại nào trong 3 loại dưới đây, sau đó trích xuất dữ liệu:

1. 'honor': Ảnh BẢNG DANH DỰ (Honor Roll / Honor Ranking)
   - Cấu trúc thanh người chơi: [Rank ví dụ 201] [Avatar] [Tên ví dụ [LOST] Loki] [#Vương quốc ví dụ #1903] [Điểm Danh Dự ở ngoài cùng bên phải ví dụ 35.004].
   - Tên người chơi (playerName): ví dụ '[LOST] Loki' (bỏ số thứ hạng rank đầu dòng và bỏ #1903). Giữ nguyên tag liên minh nếu có.
   - Điểm Danh Dự (honorValue): LÀ CON SỐ NẰM Ở NGOÀI CÙNG BÊN PHẢI (FAR-RIGHT) CỦA THANH RUY-BĂNG (ví dụ: '35.004', '30.012'). BẮT BUỘC TRÍCH XUẤT CON SỐ NGOÀI CÙNG NÀY dạng chuỗi ví dụ "35.004".
2. 'ap': Ảnh KHO ĐỒ / TÚI ĐỒ chứa BÌNH AP (Action Point)
   - CHỈ nhận diện các ô chứa BÌNH THỦY TINH DUNG DỊCH MÀU XANH LÁ CÂY, nút thắt dây đỏ.
   - BỎ QUA tất cả chìa khóa, đồng xu, token, sách, trượng...
   - Trích xuất số lượng bình: ap50, ap100, ap500, ap1000.
3. 'speedup': Ảnh KHO TĂNG TỐC (Speedups)
   - Dòng 'Tăng tốc' ở cuối: universalDays, universalHours, universalMinutes.
   - Dòng 'Tăng tốc huấn luyện': trainingDays, trainingHours, trainingMinutes.
   - Dòng 'Tăng tốc chữa lành': healingDays, healingHours, healingMinutes.`;

  const configObj: Record<string, unknown> = {
    systemInstruction: `Bạn là trợ lý AI chuyên phân loại và nhận diện dữ liệu game Rise of Kingdoms (ROK). Hãy xác định imageType ('honor', 'ap', hoặc 'speedup') và trích xuất đúng dữ liệu.`,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        imageType: {
          type: Type.STRING,
          enum: ['honor', 'ap', 'speedup'],
          description: "Loại ảnh: 'honor' (Bảng danh dự), 'ap' (Kho túi đồ bình AP), 'speedup' (Tài nguyên tăng tốc)",
        },
        // Honor
        honorValue: { type: Type.STRING, description: 'Điểm Danh Dự ở ngoài cùng bên phải thanh ruy-băng trong Bảng Danh Dự (ví dụ "35.004" hoặc "35004")' },
        playerName: { type: Type.STRING, description: 'Tên người chơi, ví dụ "[LOST] Loki"' },
        // AP
        ap50: { type: Type.INTEGER, description: 'Bình 50 AP' },
        ap100: { type: Type.INTEGER, description: 'Bình 100 AP' },
        ap500: { type: Type.INTEGER, description: 'Bình 500 AP' },
        ap1000: { type: Type.INTEGER, description: 'Bình 1000 AP' },
        // Speedup
        universalDays: { type: Type.INTEGER },
        universalHours: { type: Type.INTEGER },
        universalMinutes: { type: Type.INTEGER },
        trainingDays: { type: Type.INTEGER },
        trainingHours: { type: Type.INTEGER },
        trainingMinutes: { type: Type.INTEGER },
        healingDays: { type: Type.INTEGER },
        healingHours: { type: Type.INTEGER },
        healingMinutes: { type: Type.INTEGER },
      },
      required: ['imageType'],
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
      config: getModelConfig(model, configObj),
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
  const detectedType: string = parsed.imageType || 'honor';

  if (detectedType === 'ap') {
    const ap50 = Math.max(0, Number(parsed.ap50) || 0);
    const ap100 = Math.max(0, Number(parsed.ap100) || 0);
    const ap500 = Math.max(0, Number(parsed.ap500) || 0);
    const ap1000 = Math.max(0, Number(parsed.ap1000) || 0);
    const potions = [
      { cost: 50, quantity: ap50 },
      { cost: 100, quantity: ap100 },
      { cost: 500, quantity: ap500 },
      { cost: 1000, quantity: ap1000 },
    ];
    const totalAP = potions.reduce((s, p) => s + p.cost * p.quantity, 0);
    return {
      type: 'ap',
      result: { potions, totalAP },
    };
  }

  if (detectedType === 'speedup') {
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
      type: 'speedup',
      result: {
        universal: { days: uD, hours: uH, minutes: uM, totalMinutes: uD * 1440 + uH * 60 + uM, rawStr: `${uD}d ${uH}h ${uM}m` },
        training: { days: tD, hours: tH, minutes: tM, totalMinutes: tD * 1440 + tH * 60 + tM, rawStr: `${tD}d ${tH}h ${tM}m` },
        healing: { days: hD, hours: hH, minutes: hM, totalMinutes: hD * 1440 + hH * 60 + hM, rawStr: `${hD}d ${hH}h ${hM}m` },
      },
    };
  }

  // Default to honor
  const rawHonor = parsed.honorValue ?? parsed.honor ?? parsed.honorPoints ?? parsed.points ?? parsed.score;
  let honorValue = parseHonorValue(rawHonor);

  // Fallback 1: match ROK honor score pattern XX.XXX in raw output
  if (honorValue === 0) {
    const match = rawJson.match(/\b(\d{1,3}[\.,]\d{3}(?:[\.,]\d{3})?)\b/);
    if (match) {
      honorValue = parseHonorValue(match[1]);
    }
  }

  let playerName = typeof parsed.playerName === 'string' && parsed.playerName.trim()
    ? parsed.playerName.trim()
    : undefined;

  if (!playerName) {
    const pMatch = rawJson.match(/"playerName"\s*:\s*"([^"]+)"/);
    if (pMatch) playerName = pMatch[1].trim();
  }

  // Fallback 2: if honorValue is STILL 0, invoke scanHonorWithAI directly!
  if (honorValue === 0) {
    try {
      const dedicated = await scanHonorWithAI(file, apiKey, modelName);
      if (dedicated.honorValue > 0) honorValue = dedicated.honorValue;
      if (!playerName && dedicated.playerName) playerName = dedicated.playerName;
    } catch (e) {
      console.warn('Dedicated honor scan fallback failed:', e);
    }
  }

  return {
    type: 'honor',
    result: { honorValue, playerName, confidence: 'high' },
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
