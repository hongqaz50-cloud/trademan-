/**
 * excelExport.ts — Generates professional multi-sheet Excel reports (.xlsx)
 * Includes:
 * 1. Detailed shift log (Chi tiết ca làm) with formulas
 * 2. Payroll calculator (Bảng tính lương nhân viên) with dynamic salary formulas
 */

import ExcelJS from 'exceljs';
import type { CompletedShift } from './shifts';
import { formatVNDate, formatVNMonth } from './timeUtils';

export interface ExcelExportOptions {
  monthFilter?: string; // e.g. "10/2026"
  now?: number;
}

export async function generateMonthlyExcelReport(
  shifts: CompletedShift[],
  options: ExcelExportOptions = {}
): Promise<{ buffer: Buffer; fileName: string; totalShifts: number; totalHours: number }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AP Efficiency Discord Bot';
  workbook.lastModifiedBy = 'AP Efficiency Bot';
  workbook.created = new Date();
  workbook.modified = new Date();

  const now = options.now || Date.now();
  const currentMonthStr = options.monthFilter || formatVNMonth(now);
  const exportDateStr = `${formatVNDate(now)}`;

  const sanitizedMonth = currentMonthStr.replace('/', '_');
  const fileName = `Bao_Cao_Ca_Lam_Thang_${sanitizedMonth}.xlsx`;

  // ── SHEET 1: Chi Tiết Ca Làm (Shift Details) ───────────────────────────────

  const sheet1 = workbook.addWorksheet('Chi Tiết Ca Làm', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  sheet1.mergeCells('A1:O1');
  const title1 = sheet1.getCell('A1');
  title1.value = 'BẢNG KÊ CHI TIẾT CA LÀM VIỆC & HIỆU SUẤT PILOT';
  title1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' }, // Navy blue
  };
  title1.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet1.getRow(1).height = 36;

  sheet1.mergeCells('A2:O2');
  const sub1 = sheet1.getCell('A2');
  sub1.value = `Kỳ tính: Tháng ${currentMonthStr}   |   Ngày xuất file: ${exportDateStr}   |   Đơn vị: ROK Pilot Team`;
  sub1.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
  sub1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF334155' }, // Slate
  };
  sub1.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet1.getRow(2).height = 24;

  // Blank row
  sheet1.getRow(3).height = 10;

  // Table Headers (Row 4)
  const headers1 = [
    'STT',
    'Ngày',
    'Tên Pilot (Nhân Viên)',
    'Tài Khoản Game',
    'Khung Giờ (UTC+7 / ROK)',
    'Số Giờ Làm',
    'Điểm Danh Dự',
    'AP Tiêu Hao',
    'Quái Diệt',
    'Hiệu Suất',
    'Xếp Hạng',
    'Tăng Tốc Universal',
    'Tăng Tốc Training',
    'Tăng Tốc Healing',
    'Ghi Chú',
  ];

  const headerRow1 = sheet1.getRow(4);
  headerRow1.values = headers1;
  headerRow1.height = 30;

  headerRow1.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Dark slate
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });

  // Populate Data Rows
  let startDataRow1 = 5;
  let currentRow1 = startDataRow1;

  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i];
    const row = sheet1.getRow(currentRow1);
    const isEven = i % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    row.values = [
      i + 1,
      s.dateStr,
      s.pilotName,
      s.accountName,
      s.timeRangeStr,
      s.hoursFloat,
      s.honorGained,
      s.apSpent,
      s.monstersKilled,
      s.efficiencyRate / 100,
      s.efficiencyGrade,
      s.universalSpeed,
      s.trainingSpeed,
      s.healingSpeed,
      s.note,
    ];
    row.height = 22;

    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alignment and formats per column
      if (colNumber === 1 || colNumber === 2 || colNumber === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber >= 3 && colNumber <= 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.0';
      } else if (colNumber === 7 || colNumber === 8 || colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.0%';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Grade text color badge
      if (colNumber === 11) {
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: {
            argb:
              s.efficiencyGrade === 'SS' || s.efficiencyGrade === 'S'
                ? 'FF15803D' // Green
                : s.efficiencyGrade === 'A'
                ? 'FF0369A1' // Blue
                : s.efficiencyGrade === 'B'
                ? 'FFB45309' // Amber
                : 'FFB91C1C', // Red
          },
        };
      }
    });

    currentRow1++;
  }

  // Summary Row (Sheet 1)
  const lastDataRow1 = currentRow1 - 1;
  const totalRow1 = sheet1.getRow(currentRow1);
  totalRow1.height = 26;

  if (shifts.length > 0) {
    totalRow1.getCell(1).value = `TỔNG CỘNG (${shifts.length} ca làm)`;
    sheet1.mergeCells(`A${currentRow1}:E${currentRow1}`);

    totalRow1.getCell(6).value = { formula: `=SUM(F${startDataRow1}:F${lastDataRow1})` };
    totalRow1.getCell(7).value = { formula: `=SUM(G${startDataRow1}:G${lastDataRow1})` };
    totalRow1.getCell(8).value = { formula: `=SUM(H${startDataRow1}:H${lastDataRow1})` };
    totalRow1.getCell(9).value = { formula: `=SUM(I${startDataRow1}:I${lastDataRow1})` };
    totalRow1.getCell(10).value = { formula: `=AVERAGE(J${startDataRow1}:J${lastDataRow1})` };
  } else {
    totalRow1.getCell(1).value = 'Chưa có ca làm nào trong kỳ này.';
    sheet1.mergeCells(`A${currentRow1}:O${currentRow1}`);
  }

  totalRow1.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
    if (colNumber === 6) cell.numFmt = '0.0';
    if (colNumber === 7 || colNumber === 8 || colNumber === 9) cell.numFmt = '#,##0';
    if (colNumber === 10) cell.numFmt = '0.0%';
  });

  // Set explicit column widths for Sheet 1
  const colWidths1 = [6, 13, 22, 22, 36, 14, 16, 15, 12, 13, 12, 20, 20, 20, 18];
  colWidths1.forEach((w, idx) => {
    sheet1.getColumn(idx + 1).width = w;
  });

  // ── SHEET 2: Bảng Tính Lương Pilot (Payroll Summary) ────────────────────────

  const sheet2 = workbook.addWorksheet('Bảng Tính Lương Pilot', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  sheet2.mergeCells('A1:J1');
  const title2 = sheet2.getCell('A1');
  title2.value = 'BẢNG TỔNG HỢP CÔNG & TÍNH TIỀN LƯƠNG PILOT';
  title2.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF065F46' }, // Dark Emerald
  };
  title2.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet2.getRow(1).height = 36;

  sheet2.mergeCells('A2:J2');
  const sub2 = sheet2.getCell('A2');
  sub2.value = `💡 Hướng dẫn: Quản lý chỉ cần nhập đơn giá tiền công vào cột màu vàng (E), Excel sẽ tự động tính thành tiền lương cho từng Pilot!`;
  sub2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFFFFFFF' } };
  sub2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' }, // Medium Emerald
  };
  sub2.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet2.getRow(2).height = 24;

  sheet2.getRow(3).height = 10;

  // Table Headers (Row 4)
  const headers2 = [
    'STT',
    'Tên Pilot (Nhân Viên)',
    'Tổng Số Ca Làm',
    'Tổng Số Giờ Làm',
    'Đơn Giá / Giờ (VNĐ)',
    'THÀNH TIỀN LƯƠNG (VNĐ)',
    'Tổng AP Tiêu Hao',
    'Tổng Danh Dự Đạt',
    'Hiệu Suất TB',
    'Đánh Giá',
  ];

  const headerRow2 = sheet2.getRow(4);
  headerRow2.values = headers2;
  headerRow2.height = 30;

  headerRow2.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber === 5 ? 'FFB45309' : 'FF064E3B' }, // Yellow-amber for rate header
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF064E3B' } },
      bottom: { style: 'medium', color: { argb: 'FF064E3B' } },
      left: { style: 'thin', color: { argb: 'FF064E3B' } },
      right: { style: 'thin', color: { argb: 'FF064E3B' } },
    };
  });

  // Group by unique Pilot
  const pilotMap = new Map<
    string,
    {
      pilotName: string;
      shiftCount: number;
      totalHours: number;
      totalAP: number;
      totalHonor: number;
      efficiencyList: number[];
    }
  >();

  for (const s of shifts) {
    const key = s.pilotName.trim();
    if (!pilotMap.has(key)) {
      pilotMap.set(key, {
        pilotName: key,
        shiftCount: 0,
        totalHours: 0,
        totalAP: 0,
        totalHonor: 0,
        efficiencyList: [],
      });
    }
    const item = pilotMap.get(key)!;
    item.shiftCount++;
    item.totalHours += s.hoursFloat;
    item.totalAP += s.apSpent;
    item.totalHonor += s.honorGained;
    item.efficiencyList.push(s.efficiencyRate);
  }

  const pilotList = Array.from(pilotMap.values());
  let startDataRow2 = 5;
  let currentRow2 = startDataRow2;

  for (let i = 0; i < pilotList.length; i++) {
    const p = pilotList[i];
    const avgEff =
      p.efficiencyList.length > 0
        ? p.efficiencyList.reduce((a, b) => a + b, 0) / p.efficiencyList.length
        : 100;

    let evaluation = 'Xuất Sắc (S)';
    if (avgEff >= 120) evaluation = 'Thần Thánh (SS)';
    else if (avgEff >= 100) evaluation = 'Xuất Sắc (S)';
    else if (avgEff >= 80) evaluation = 'Đạt Chuẩn (A)';
    else if (avgEff >= 60) evaluation = 'Khá (B)';
    else evaluation = 'Cần Cố Gắng (C)';

    const row = sheet2.getRow(currentRow2);
    row.values = [
      i + 1,
      p.pilotName,
      p.shiftCount,
      Math.round(p.totalHours * 10) / 10,
      0, // Default hourly rate = 0 (for manager to input)
      { formula: `=D${currentRow2}*E${currentRow2}` }, // Salary Formula: Hours * Rate
      p.totalAP,
      p.totalHonor,
      avgEff / 100,
      evaluation,
    ];
    row.height = 24;

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1 || colNumber === 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Calibri', size: 11, bold: true };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.0';
        cell.font = { bold: true };
      } else if (colNumber === 5) {
        // Highlight input cell in soft yellow
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' }, // Light amber/yellow
        };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
        cell.font = { bold: true, color: { argb: 'FF92400E' } };
      } else if (colNumber === 6) {
        // Grand Salary calculation in Bold Green
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFECFDF5' }, // Soft green
        };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0 "đ"';
        cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF047857' } };
      } else if (colNumber === 7 || colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.0%';
      }
    });

    currentRow2++;
  }

  // Summary Row (Sheet 2)
  const lastDataRow2 = currentRow2 - 1;
  const totalRow2 = sheet2.getRow(currentRow2);
  totalRow2.height = 28;

  if (pilotList.length > 0) {
    totalRow2.getCell(1).value = `TỔNG CỘNG TOÀN ĐỘI (${pilotList.length} nhân viên)`;
    sheet2.mergeCells(`A${currentRow2}:B${currentRow2}`);

    totalRow2.getCell(3).value = { formula: `=SUM(C${startDataRow2}:C${lastDataRow2})` };
    totalRow2.getCell(4).value = { formula: `=SUM(D${startDataRow2}:D${lastDataRow2})` };
    totalRow2.getCell(5).value = '-';
    totalRow2.getCell(6).value = { formula: `=SUM(F${startDataRow2}:F${lastDataRow2})` }; // Total payroll payout
    totalRow2.getCell(7).value = { formula: `=SUM(G${startDataRow2}:G${lastDataRow2})` };
    totalRow2.getCell(8).value = { formula: `=SUM(H${startDataRow2}:H${lastDataRow2})` };
    totalRow2.getCell(9).value = { formula: `=AVERAGE(I${startDataRow2}:I${lastDataRow2})` };
  } else {
    totalRow2.getCell(1).value = 'Chưa có nhân viên nào hoàn thành ca làm.';
    sheet2.mergeCells(`A${currentRow2}:J${currentRow2}`);
  }

  totalRow2.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF064E3B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' }, // Emerald tint
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF064E3B' } },
      bottom: { style: 'double', color: { argb: 'FF064E3B' } },
      left: { style: 'thin', color: { argb: 'FF6EE7B7' } },
      right: { style: 'thin', color: { argb: 'FF6EE7B7' } },
    };
    if (colNumber === 3) cell.numFmt = '#,##0';
    if (colNumber === 4) cell.numFmt = '0.0';
    if (colNumber === 6) {
      cell.numFmt = '#,##0 "đ"';
      cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF065F46' } };
    }
    if (colNumber === 7 || colNumber === 8) cell.numFmt = '#,##0';
    if (colNumber === 9) cell.numFmt = '0.0%';
  });

  // Set explicit column widths for Sheet 2
  const colWidths2 = [6, 24, 16, 18, 22, 26, 18, 18, 16, 18];
  colWidths2.forEach((w, idx) => {
    sheet2.getColumn(idx + 1).width = w;
  });

  // Write to Buffer
  const buffer = await workbook.xlsx.writeBuffer();

  const totalHours = shifts.reduce((acc, s) => acc + s.hoursFloat, 0);

  return {
    buffer: Buffer.from(buffer),
    fileName,
    totalShifts: shifts.length,
    totalHours: Math.round(totalHours * 10) / 10,
  };
}
