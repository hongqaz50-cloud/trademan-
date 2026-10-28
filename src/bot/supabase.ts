/**
 * supabase.ts — Supabase Cloud Database Client & Persistence
 * Project: https://ssjmdhprgagydhiynqii.supabase.co
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CompletedShift, ActiveShift } from './shifts';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ssjmdhprgagydhiynqii.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'sb_publishable_CB86jv-LYBmHH5gerSs5XQ_vBl8oA7H';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('⚡ Đã kết nối Supabase Cloud Database:', SUPABASE_URL);
    } catch (err) {
      console.error('❌ Lỗi kết nối Supabase:', err);
    }
  }
  return supabaseInstance;
}

export function isSupabaseConnected(): boolean {
  return Boolean(getSupabase());
}

// ── 1. Completed Shifts ──────────────────────────────────────────────────────

export async function saveCompletedShiftToSupabase(shift: CompletedShift): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('completed_shifts').upsert({
      id: shift.id,
      guild_id: shift.guildId || null,
      guild_name: shift.guildName || null,
      user_id: shift.userId,
      pilot_name: shift.pilotName,
      account_name: shift.accountName,
      note: shift.note,
      start_time: shift.startTime,
      end_time: shift.endTime,
      date_str: shift.dateStr,
      month_str: shift.monthStr,
      time_range_str: shift.timeRangeStr,
      hours_str: shift.hoursStr,
      hours_float: shift.hoursFloat,
      honor_gained: shift.honorGained,
      ap_spent: shift.apSpent,
      monsters_killed: shift.monstersKilled,
      efficiency_rate: shift.efficiencyRate,
      efficiency_grade: shift.efficiencyGrade,
      universal_speed: shift.universalSpeed,
      training_speed: shift.trainingSpeed,
      healing_speed: shift.healingSpeed,
      created_at: shift.createdAt,
    });

    if (error) {
      console.error('Lỗi lưu ca vào Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Lỗi ngoại lệ Supabase completed_shifts:', err);
    return false;
  }
}

export async function loadCompletedShiftsFromSupabase(
  filterMonth?: string,
  guildId?: string
): Promise<CompletedShift[] | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    let query = sb.from('completed_shifts').select('*').order('created_at', { ascending: true });

    if (filterMonth && filterMonth.trim().toLowerCase() !== 'all') {
      const target = filterMonth.trim();
      query = query.eq('month_str', target);
    }

    if (guildId) {
      query = query.eq('guild_id', guildId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Lỗi đọc ca từ Supabase:', error.message);
      return null;
    }

    return (data || []).map((row) => ({
      id: row.id,
      guildId: row.guild_id,
      guildName: row.guild_name,
      userId: row.user_id,
      pilotName: row.pilot_name,
      accountName: row.account_name,
      note: row.note,
      startTime: Number(row.start_time),
      endTime: Number(row.end_time),
      dateStr: row.date_str,
      monthStr: row.month_str,
      timeRangeStr: row.time_range_str,
      hoursStr: row.hours_str,
      hoursFloat: Number(row.hours_float),
      honorGained: Number(row.honor_gained),
      apSpent: Number(row.ap_spent),
      monstersKilled: Number(row.monsters_killed),
      efficiencyRate: Number(row.efficiency_rate),
      efficiencyGrade: row.efficiency_grade,
      universalSpeed: row.universal_speed,
      trainingSpeed: row.training_speed,
      healingSpeed: row.healing_speed,
      createdAt: Number(row.created_at),
    }));
  } catch (err) {
    console.error('Lỗi ngoại lệ đọc Supabase:', err);
    return null;
  }
}

// ── 2. Active Shifts ─────────────────────────────────────────────────────────

export async function saveActiveShiftToSupabase(shift: ActiveShift): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('active_shifts').upsert({
      user_id: shift.userId,
      guild_id: shift.guildId || null,
      pilot_name: shift.pilotName,
      account_name: shift.accountName,
      note: shift.note,
      start_time: shift.startTime,
      start_honor: shift.startHonor,
      start_ap: shift.startAP,
      ap50: shift.ap50,
      ap100: shift.ap100,
      ap500: shift.ap500,
      ap1000: shift.ap1000,
      universal_minutes: shift.universalMinutes,
      training_minutes: shift.trainingMinutes,
      healing_minutes: shift.healingMinutes,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteActiveShiftFromSupabase(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('active_shifts').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}
