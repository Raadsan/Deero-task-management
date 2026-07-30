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
) {
  const htmlRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#0a2744}
    .header{display:flex;justify-content:space-between;border-bottom:4px solid #1565c0;padding-bottom:16px;margin-bottom:22px}
    h1{margin:0;font-size:26px}.meta{color:#64748b;font-size:12px;text-align:right}
    table{width:100%;border-collapse:collapse}th{background:#0a2744;color:white;padding:10px;text-align:left;font-size:11px;text-transform:uppercase}
    td{border-bottom:1px solid #e5e7eb;padding:9px 10px;font-size:12px}tr:nth-child(even) td{background:#f8fafc}
  </style></head><body>
    <div class="header"><div><h1>${escapeHtml(title)}</h1><p style="margin:6px 0 0;color:#64748b;font-size:13px;">Deero Advert Report</p></div>
    <div class="meta"><strong>Generated</strong><br/>${escapeHtml(new Date().toLocaleString())}<br/><strong>Total Rows</strong><br/>${rows.length}</div></div>
    <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${htmlRows || `<tr><td colspan="${headers.length}">No data found</td></tr>`}</tbody></table>
    <script>window.onload=()=>window.print()</script>
  </body></html>`;

  const win = window.open("", "_blank", "width=1000,height=720");
  if (!win) throw new Error("Please allow popups to print report");
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export type PdfReportOptions = {
  subtitle?: string;
  logoUrl?: string | null;
  primaryColor?: string;
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
  doc.text(options.subtitle || "All time", textX, 58);
  doc.text(`Generated ${new Date().toLocaleString()}`, textX, 72);
  doc.setDrawColor(...primary);
  doc.setLineWidth(2);
  doc.line(40, 88, 802, 88);

  autoTable(doc, {
    startY: 102,
    head: [headers],
    body: rows.map((row) => row.map((cell) => String(cell ?? "—"))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: primary, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
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
