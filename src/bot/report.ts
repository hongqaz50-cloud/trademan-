/**
 * report.ts — Computes efficiency metrics and generates report text & Discord Embeds
 */

import { EmbedBuilder } from 'discord.js';
import type { ActiveShift } from './shifts';
import type { BotScanResult } from './vision';
import { buildTimeRangeString, calculateShiftHours, formatSpeedupDelta } from './timeUtils';

export interface FinalReportData {
  accountName: string;
  pilotName: string;
  timeStr: string;
  hoursStr: string;
  hoursFloat: number;
  startTime: number;
  endTime: number;
  durationFormatted: string;
  honorGained: number;
  apSpent: number;
  universalSpeed: string;
  trainingSpeed: string;
  healingSpeed: string;
  note: string;
  monstersKilled: number;
  totalRuns: number;
  monstersPerRun: number;
  efficiencyRate: number;
  efficiencyTier: { label: string; color: number; grade: string };
  reportText: string;
}

export function computeShiftReport(
  shift: ActiveShift,
  endScan: BotScanResult,
  endTime: number,
  overrideNote?: string
): FinalReportData {
  const accountName = endScan.accountName !== 'Unknown' ? endScan.accountName : shift.accountName;
  const pilotName = shift.pilotName;
  const note = (overrideNote && overrideNote.trim()) || shift.note || '5 marches';

  const timeStr = buildTimeRangeString(shift.startTime, endTime);
  const { hoursStr, durationFormatted, hoursFloat } = calculateShiftHours(shift.startTime, endTime);

  const honorGained = Math.max(0, endScan.honorValue - shift.startHonor);
  const apSpent = Math.max(0, shift.startAP - endScan.totalAP);

  const universalSpeed = formatSpeedupDelta(endScan.universalMinutes - shift.universalMinutes);
  const trainingSpeed = formatSpeedupDelta(endScan.trainingMinutes - shift.trainingMinutes);
  const healingSpeed = formatSpeedupDelta(endScan.healingMinutes - shift.healingMinutes);

  // Math metrics (ROK Baseline: 3 monsters / 65 AP)
  const monstersKilled = honorGained / 10;
  const totalRuns = apSpent > 0 ? apSpent / 65 : 0;
  const monstersPerRun = totalRuns > 0 ? monstersKilled / totalRuns : 0;
  const efficiencyRate = (monstersPerRun / 3) * 100;

  // Grade tier
  let efficiencyTier = { label: 'Xuất Sắc', color: 0x10b981, grade: 'S' };
  if (efficiencyRate >= 120) {
    efficiencyTier = { label: 'Thần Thánh', color: 0x8b5cf6, grade: 'SS' };
  } else if (efficiencyRate >= 100) {
    efficiencyTier = { label: 'Xuất Sắc', color: 0x10b981, grade: 'S' };
  } else if (efficiencyRate >= 80) {
    efficiencyTier = { label: 'Đạt Chuẩn', color: 0x06b6d4, grade: 'A' };
  } else if (efficiencyRate >= 60) {
    efficiencyTier = { label: 'Khá', color: 0xf59e0b, grade: 'B' };
  } else {
    efficiencyTier = { label: 'Cần Tối Ưu', color: 0xef4444, grade: 'C' };
  }

  // Exact Monospace Report Text matching Client Format
  const reportText = [
    `Account: ${accountName}`,
    `Pilot: ${pilotName}`,
    `Time: ${timeStr}`,
    `Hours: ${hoursStr}`,
    `Honor Points: ${honorGained.toLocaleString('en-US').replace(/,/g, '')}`,
    `Ap Used: ${apSpent.toLocaleString('en-US').replace(/,/g, '')}`,
    `Universal speed: ${universalSpeed}`,
    `Training speed: ${trainingSpeed}`,
    `Healing speed: ${healingSpeed}`,
    `Note: ${note}`,
  ].join('\n');

  return {
    accountName,
    pilotName,
    timeStr,
    hoursStr,
    hoursFloat,
    startTime: shift.startTime,
    endTime,
    durationFormatted,
    honorGained,
    apSpent,
    universalSpeed,
    trainingSpeed,
    healingSpeed,
    note,
    monstersKilled,
    totalRuns,
    monstersPerRun,
    efficiencyRate,
    efficiencyTier,
    reportText,
  };
}

/** Builds rich Discord Embed for the final report */
export function buildReportEmbed(data: FinalReportData): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📋 BÁO CÁO HOÀN THÀNH CA LÀM (PILOT REPORT)')
    .setColor(data.efficiencyTier.color)
    .addFields(
      {
        name: '👤 Thông Tin Ca Làm',
        value: `**Pilot:** \`${data.pilotName}\`\n**Account:** \`${data.accountName}\`\n**Ghi chú:** \`${data.note}\``,
        inline: false,
      },
      {
        name: '⏰ Thời Gian (UTC+7 / ROK)',
        value: `**Khung giờ:** ${data.timeStr}\n**Tổng số giờ:** \`${data.hoursStr}h\` (${data.durationFormatted})`,
        inline: false,
      },
      {
        name: '🎖️ Danh Dự Đạt Được',
        value: `**+${data.honorGained.toLocaleString('en-US')}** Điểm\n*(~${data.monstersKilled.toLocaleString('en-US')} quái tiêu diệt)*`,
        inline: true,
      },
      {
        name: '🧪 AP Tiêu Hao',
        value: `**${data.apSpent.toLocaleString('en-US')}** AP\n*(~${data.totalRuns.toFixed(1)} lượt x 65 AP)*`,
        inline: true,
      },
      {
        name: `⚡ Hiệu Suất Chiến Đấu [${data.efficiencyTier.grade}]`,
        value: `**${data.efficiencyRate.toFixed(1)}%** (${data.monstersPerRun.toFixed(2)} quái/run)\nĐánh giá: **${data.efficiencyTier.label}**`,
        inline: true,
      },
      {
        name: '📦 Tiêu Hao Tăng Tốc (Speedups)',
        value: `• **Universal:** \`${data.universalSpeed}\`\n• **Training:** \`${data.trainingSpeed}\`\n• **Healing:** \`${data.healingSpeed}\``,
        inline: false,
      }
    )
    .setFooter({ text: 'AP Efficiency Analyzer · Copy nội dung bên dưới để gửi khách' })
    .setTimestamp();

  return embed;
}
