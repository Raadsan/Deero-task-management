export function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
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

export async function exportPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Deero Advert · Generated ${new Date().toLocaleString()} · ${rows.length} rows`,
    40,
    58,
  );

  autoTable(doc, {
    startY: 72,
    head: [headers],
    body: rows.map((row) => row.map((cell) => String(cell ?? "—"))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [10, 39, 68], textColor: 255 },
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
