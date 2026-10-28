/**
 * config.ts — Discord Bot & Gemini configuration
 */

import 'dotenv/config';

import fs from 'fs';
import path from 'path';

function cleanKey(raw: string): string {
  return raw.trim().replace(/^[<"']+|[>"']+$/g, '').trim();
}

export const DISCORD_BOT_TOKEN = cleanKey(process.env.DISCORD_BOT_TOKEN || '');
export let GEMINI_API_KEY = cleanKey(process.env.GEMINI_API_KEY || '');
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1563924967996002406';

export function updateGeminiApiKey(key: string): void {
  const cleaned = cleanKey(key);
  GEMINI_API_KEY = cleaned;
  process.env.GEMINI_API_KEY = cleaned;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    if (content.includes('GEMINI_API_KEY=')) {
      content = content.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${cleaned}`);
    } else {
      content += `\nGEMINI_API_KEY=${cleaned}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf-8');
  } catch (err) {
    console.error('Không thể ghi file .env:', err);
  }
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!DISCORD_BOT_TOKEN) {
    errors.push('Thiếu DISCORD_BOT_TOKEN trong file .env');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
