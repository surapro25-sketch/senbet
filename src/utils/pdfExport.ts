import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { AttendanceRecord, ExamResult } from '../types';
import { ATTENDANCE_LABELS, getGradeLabel } from './school';

function triggerPdfDownload(pdf: jsPDF, filename: string) {
  const finalName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  try {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = finalName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    pdf.save(finalName);
  }
}

async function renderHtmlToPdf(htmlContent: string, filename: string) {
  await document.fonts.ready;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#18181b';
  container.style.padding = '36px';
  container.style.fontFamily = '"Noto Sans Ethiopic", "Plus Jakarta Sans", sans-serif';
  container.style.zIndex = '-1';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    triggerPdfDownload(pdf, filename);
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportExamResultsPdf(
  exams: ExamResult[],
  gradeLabel: string,
  generatedBy: string
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const rowsHtml = exams
    .map(
      (e, idx) => `
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 8px 10px; font-size: 12px; color: #52525b;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-size: 12px; font-weight: 600;">${escapeHtml(e.studentName || '')}</td>
        <td style="padding: 8px 10px; font-size: 12px;">${escapeHtml(getGradeLabel(e.grade))}</td>
        <td style="padding: 8px 10px; font-size: 12px;">${escapeHtml(e.subject)}</td>
        <td style="padding: 8px 10px; font-size: 12px;">${escapeHtml(e.examTitle)}</td>
        <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; text-align: right;">${e.score} / ${e.maxScore}</td>
        <td style="padding: 8px 10px; font-size: 12px; color: #52525b;">${escapeHtml(e.remarks || '—')}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="border-bottom: 2px solid #18181b; padding-bottom: 14px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #71717a; margin-bottom: 4px;">ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ — የትምህርትና አስተዳደር መድረክ</div>
      <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 6px 0; color: #18181b;">የተማሪዎች የፈተና ውጤት መግለጫ (${escapeHtml(gradeLabel)})</h1>
      <div style="font-size: 12px; color: #52525b;">
        ቀን፡ ${dateStr} &nbsp;·&nbsp; አዘጋጅ፡ ${escapeHtml(generatedBy)} &nbsp;·&nbsp; ጠቅላላ መዝገቦች፡ ${exams.length}
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr style="background-color: #f4f4f5; border-bottom: 1px solid #d4d4d8;">
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ተ.ቁ</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">የተማሪ ሙሉ ስም</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ክፍል</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">የትምህርት አይነት</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ፈተና</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46; text-align: right;">ውጤት</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">አስተያየት</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="7" style="padding: 16px; text-align: center; color: #71717a;">ምንም የፈተና ውጤት አልተመዘገበም</td></tr>'}
      </tbody>
    </table>
  `;

  await renderHtmlToPdf(html, `ውጤት_${dateStr}.pdf`);
}

export async function exportAttendancePdf(
  records: AttendanceRecord[],
  gradeLabel: string,
  dateFilter: string,
  generatedBy: string
) {
  const dateStr = dateFilter || new Date().toISOString().slice(0, 10);
  const presentCount = records.filter((r) => r.status === 'present').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const lateCount = records.filter((r) => r.status === 'late').length;

  const rowsHtml = records
    .map(
      (r, idx) => `
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 8px 10px; font-size: 12px; color: #52525b;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-size: 12px; font-weight: 600;">${escapeHtml(r.studentName || '')}</td>
        <td style="padding: 8px 10px; font-size: 12px;">${escapeHtml(getGradeLabel(r.grade))}</td>
        <td style="padding: 8px 10px; font-size: 12px;">${escapeHtml(r.date)}</td>
        <td style="padding: 8px 10px; font-size: 12px; font-weight: 600;">${escapeHtml(ATTENDANCE_LABELS[r.status])}</td>
        <td style="padding: 8px 10px; font-size: 12px; color: #52525b;">${escapeHtml(r.note || '—')}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="border-bottom: 2px solid #18181b; padding-bottom: 14px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #71717a; margin-bottom: 4px;">ደቂቀ መዊዕ ቅዱስ መርቆሬዎስ እና መጥምቀ መለኮት ቅዱስ ዮሐንስ — የእለት አቴንዳንስ መዝገብ</div>
      <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 6px 0; color: #18181b;">የተማሪዎች አቴንዳንስ ሪፖርት (${escapeHtml(gradeLabel)})</h1>
      <div style="font-size: 12px; color: #52525b;">
        ቀን፡ ${escapeHtml(dateStr)} &nbsp;·&nbsp; አዘጋጅ፡ ${escapeHtml(generatedBy)} &nbsp;·&nbsp; ተገኝተዋል፡ ${presentCount} &nbsp;·&nbsp; ቀርተዋል፡ ${absentCount} &nbsp;·&nbsp; አርፍደዋል፡ ${lateCount}
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; text-align: left;">
      <thead>
        <tr style="background-color: #f4f4f5; border-bottom: 1px solid #d4d4d8;">
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ተ.ቁ</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">የተማሪ ሙሉ ስም</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ክፍል</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ቀን</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ሁኔታ</th>
          <th style="padding: 9px 10px; font-size: 11px; color: #3f3f46;">ማስታወሻ</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #71717a;">ምንም አቴንዳንስ አልተመዘገበም</td></tr>'}
      </tbody>
    </table>
  `;

  await renderHtmlToPdf(html, `አቴንዳንስ_${dateStr}.pdf`);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
