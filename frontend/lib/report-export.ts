export function formatReportDate(value: string | Date | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();
  return `${day}-${month}-${date.getFullYear()}`;
}

export function reportDateRangeLabel(
  values: Array<string | Date | null | undefined>,
  selectedStart = "",
  selectedEnd = "",
) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value as string | Date).getTime())
    .filter((time) => !Number.isNaN(time));
  const earliest = times.length ? new Date(Math.min(...times)) : null;
  const from = selectedStart || earliest;
  const to = selectedEnd || new Date();
  if (!from && !to) return "Period: No dated records";
  return `Period: ${formatReportDate(from)} to ${formatReportDate(to)}`;
}
export function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  metadata: Array<[string, string]> = [],
) {
  const metadataRows = metadata.map(([label, value]) => [label, value]);
  const csv = [...metadataRows, ...(metadataRows.length ? [[]] : []), headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(value?: string | number | null) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printReport(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  details?: { subtitle?: string; lines?: string[]; sections?: ReportSection[] },
) {
  const sections = details?.sections?.length ? details.sections : [{ title, headers, rows }];
  const tables = sections.map((section) => {
    const htmlRows = section.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("");
    return `<h2>${escapeHtml(section.title)}</h2><table><thead><tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${htmlRows || `<tr><td colspan="${section.headers.length}">No data found</td></tr>`}</tbody></table>`;
  }).join("");
  const lines = [details?.subtitle, ...(details?.lines || [])].filter(Boolean);
  const html = `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#0a2744}
    .header{display:flex;justify-content:space-between;border-bottom:4px solid #651210;padding-bottom:16px;margin-bottom:22px}
    h1{margin:0;font-size:26px}h2{margin:22px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.04em}
    .meta{color:#64748b;font-size:12px;text-align:right}.lines{margin:8px 0 0;color:#475569;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#651210;color:white;padding:10px;text-align:left;font-size:11px;text-transform:uppercase}
    td{border-bottom:1px solid #e5e7eb;padding:9px 10px;font-size:12px}tr:nth-child(even) td{background:#f8fafc}
  </style></head><body>
    <div class="header"><div><h1>${escapeHtml(title)}</h1><p style="margin:6px 0 0;color:#64748b;font-size:13px;">Deero Advert Report</p>
    ${lines.length ? `<p class="lines">${lines.map((line) => escapeHtml(line)).join("<br/>")}</p>` : ""}</div>
    <div class="meta"><strong>Generated</strong><br/>${escapeHtml(new Date().toLocaleString())}</div></div>
    ${tables}
    <script>window.onload=()=>window.print()</script>
  </body></html>`;

  const win = window.open("", "_blank", "width=1000,height=720");
  if (!win) throw new Error("Please allow popups to print report");
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export type ReportSection = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export type PdfReportOptions = {
  subtitle?: string;
  lines?: string[];
  logoUrl?: string | null;
  primaryColor?: string;
  sections?: ReportSection[];
};

function hexToRgb(value?: string): [number, number, number] {
  const hex = String(value || "#651210").replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  const number = Number.parseInt(normalized, 16);
  if (Number.isNaN(number)) return [101, 18, 16];
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

async function imageDataUrl(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  options: PdfReportOptions = {},
) {
  const [{ jsPDF }, autoTableModule, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    imageDataUrl(options.logoUrl).then((value) => value ?? imageDataUrl("/logo.png")),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const primary = hexToRgb(options.primaryColor);
  let textX = 40;

  if (logo) {
    try {
      const properties = doc.getImageProperties(logo);
      const maxWidth = 110;
      const maxHeight = 54;
      const ratio = Math.min(maxWidth / properties.width, maxHeight / properties.height);
      const width = properties.width * ratio;
      const height = properties.height * ratio;
      doc.addImage(logo, properties.fileType || "PNG", 40, 24, width, height);
      textX = 40 + width + 18;
    } catch {
      // Continue without a logo if its format cannot be embedded.
    }
  }

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(17);
  doc.text(title, textX, 42);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const headerLines = [options.subtitle || "All time", ...(options.lines || []), `Generated ${new Date().toLocaleString()}`];
  headerLines.forEach((line, index) => doc.text(String(line), textX, 58 + index * 12));
  const ruleY = 58 + headerLines.length * 12 + 8;
  doc.setDrawColor(...primary);
  doc.setLineWidth(2);
  doc.line(40, ruleY, 802, ruleY);

  const sections = options.sections?.length ? options.sections : [{ title, headers, rows }];
  let cursor = ruleY + 16;
  sections.forEach((section) => {
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(section.title, 40, cursor);
    autoTable(doc, {
      startY: cursor + 8,
      head: [section.headers],
      body: section.rows.map((row) => row.map((cell) => String(cell ?? "—"))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: primary, textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    cursor = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursor + 40;
    cursor += 28;
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function exportExcel(
  filename: string,
  sections: ReportSection[],
  metadata: Array<[string, string]> = [],
) {
  const metaRows = metadata.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("");
  const tables = sections.map((section) => {
    const head = section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const body = section.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    return `<h3>${escapeHtml(section.title)}</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${metaRows}</table>${tables}</body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function inDateRange(
  value: string | Date | null | undefined,
  startDate: string,
  endDate: string,
) {
  if (!value) return !startDate && !endDate;
  const time = new Date(value).getTime();
  if (startDate && time < new Date(startDate).getTime()) return false;
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (time > end.getTime()) return false;
  }
  return true;
}
