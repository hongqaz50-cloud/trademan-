/**
 * vision.ts — Gemini Multimodal Vision Analyzer for Discord attachments
 */

import { GoogleGenAI, Type } from '@google/genai';
import { GEMINI_API_KEY, GEMINI_MODEL } from './config';

export interface BotScanResult {
  accountName: string;
  honorValue: number;
  totalAP: number;
  ap50: number;
  ap100: number;
  ap500: number;
  ap1000: number;
  universalMinutes: number;
  trainingMinutes: number;
  healingMinutes: number;
  rawJson?: string;
}

/** Parses numeric honor string like "35.004" or "35,004" into 35004 */
export function parseHonorValue(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  const cleaned = raw.replace(/\s+/g, '').replace(/[.,]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/** Downloads an image URL from Discord and returns base64 and mimeType */
async function downloadDiscordImage(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Không thể tải ảnh từ Discord: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || 'image/png';
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  return { base64, mimeType: contentType.split(';')[0] };
}

/**
 * Scans a batch of 3 screenshot attachments (Honor board, AP potions, Speedups)
 * using Gemini Multimodal AI.
 */
export async function scanBatchScreenshots(imageUrls: string[]): Promise<BotScanResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const cleanKey = GEMINI_API_KEY.replace(/^[<"']+|[>"']+$/g, '').trim();
  const ai = new GoogleGenAI({ apiKey: cleanKey });

  // Download all images in parallel
  const downloaded = await Promise.all(imageUrls.map((url) => downloadDiscordImage(url)));

  const inlineParts = downloaded.map((img) => ({
    inlineData: {
      data: img.base64,
      mimeType: img.mimeType,
    },
  }));

  const prompt = `Bạn là trợ lý AI chuyên phân tích dữ liệu game Rise of Kingdoms (ROK) từ các ảnh chụp màn hình.
Bạn được cung cấp ${imageUrls.length} ảnh chụp màn hình (Bảng Danh Dự, Kho Bình AP, Kho Tăng Tốc).
HÃY PHÂN LOẠI CHÍNH XÁC VÀ TRÍCH XUẤT DỮ LIỆU CẤU TRÚC JSON:

1. TỪ ẢNH BẢNG DANH DỰ (Honor Roll):
   - Cấu trúc thanh người chơi: [Rank ví dụ 201] [Avatar] [Tên ví dụ [LOST] Loki] [#Vương quốc] [Điểm Danh Dự ở ngoài cùng bên phải ví dụ 35.004].
   - Tên người chơi (playerName): ví dụ '[LOST] Loki' (bỏ qua số thứ hạng rank đầu dòng).
   - Điểm Danh Dự (honorValue): LÀ CON SỐ NẰM Ở NGOÀI CÙNG BÊN PHẢI CỦA THANH RUY-BĂNG (ví dụ: '35.004'). BẮT BUỘC TRÍCH XUẤT CON SỐ NÀY dạng chuỗi.

2. TỪ ẢNH KHO BÌNH AP (Action Point Potions):
   - Chỉ nhận diện các ô chứa BÌNH THỦY TINH DUNG DỊCH MÀU XANH LÁ CÂY (nút thắt đỏ). Bỏ qua các vật phẩm khác.
   - Trích xuất số lượng của 4 loại bình: ap50, ap100, ap500, ap1000. Dấu chấm là phân cách hàng nghìn (ví dụ 1.065 -> 1065).

3. TỪ ẢNH KHO TĂNG TỐC (Speedups):
   - Universal Speedup: dòng 'Tăng tốc' ở cuối danh sách -> universalDays, universalHours, universalMinutes.
   - Training Speedup: dòng 'Tăng tốc huấn luyện' -> trainingDays, trainingHours, trainingMinutes.
   - Healing Speedup: dòng 'Tăng tốc chữa lành' -> healingDays, healingHours, healingMinutes.`;

  const configObj = {
    systemInstruction: `Bạn là trợ lý AI chuyên nhận diện dữ liệu game Rise of Kingdoms (ROK). Trích xuất chính xác cấu trúc JSON.`,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        playerName: { type: Type.STRING, description: 'Tên người chơi trong bảng danh dự, ví dụ [LOST] Loki' },
        honorValue: { type: Type.STRING, description: 'Điểm Danh Dự ở ngoài cùng bên phải của thanh ruy-băng trong Bảng Danh Dự (ví dụ "35.004")' },
        ap50: { type: Type.INTEGER, description: 'Số lượng bình 50 AP' },
        ap100: { type: Type.INTEGER, description: 'Số lượng bình 100 AP' },
        ap500: { type: Type.INTEGER, description: 'Số lượng bình 500 AP' },
        ap1000: { type: Type.INTEGER, description: 'Số lượng bình 1000 AP' },
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
        'playerName',
        'honorValue',
        'ap50', 'ap100', 'ap500', 'ap1000',
        'universalDays', 'universalHours', 'universalMinutes',
        'trainingDays', 'trainingHours', 'trainingMinutes',
        'healingDays', 'healingHours', 'healingMinutes',
      ],
    },
  };

  const contents = [...inlineParts, prompt];

  const candidateModels = [
    GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let response: any;
  let lastError: Error | null = null;

  for (const modelToTry of candidateModels) {
    try {
      response = await ai.models.generateContent({
        model: modelToTry,
        contents,
        config: {
          ...configObj,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });
      break; // Success!
    } catch {
      try {
        response = await ai.models.generateContent({
          model: modelToTry,
          contents,
          config: configObj,
        });
        break; // Success!
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Model ${modelToTry} gặp lỗi, đang thử model tiếp theo...`);
      }
    }
  }

  if (!response) {
    throw lastError || new Error('Không thể phân tích ảnh bằng các model Gemini hiện có.');
  }

  let rawJson = (response.text || '{}').trim();
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }

  const parsed = JSON.parse(rawJson);

  const ap50 = parsed.ap50 || 0;
  const ap100 = parsed.ap100 || 0;
  const ap500 = parsed.ap500 || 0;
  const ap1000 = parsed.ap1000 || 0;
  const totalAP = ap50 * 50 + ap100 * 100 + ap500 * 500 + ap1000 * 1000;

  const universalMinutes =
    (parsed.universalDays || 0) * 1440 +
    (parsed.universalHours || 0) * 60 +
    (parsed.universalMinutes || 0);

  const trainingMinutes =
    (parsed.trainingDays || 0) * 1440 +
    (parsed.trainingHours || 0) * 60 +
    (parsed.trainingMinutes || 0);

  const healingMinutes =
    (parsed.healingDays || 0) * 1440 +
    (parsed.healingHours || 0) * 60 +
    (parsed.healingMinutes || 0);

  return {
    accountName: parsed.playerName || 'Unknown',
    honorValue: parseHonorValue(parsed.honorValue),
    totalAP,
    ap50,
    ap100,
    ap500,
    ap1000,
    universalMinutes,
    trainingMinutes,
    healingMinutes,
    rawJson,
  };
}
