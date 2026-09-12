import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads/document-templates");

const MIME_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-word": ".doc",
};

export async function ensureTemplateUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveTemplateBackground(dataUrl, originalName = "template") {
  await ensureTemplateUploadDir();

  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid file data. Upload a PDF, DOC, DOCX, PNG, or JPG file.");
  }

  const mime = match[1].toLowerCase();
  let ext = MIME_EXT[mime];
  if (!ext) {
    const lowerName = String(originalName || "").toLowerCase();
    if (lowerName.endsWith(".docx")) ext = ".docx";
    else if (lowerName.endsWith(".doc")) ext = ".doc";
    else if (lowerName.endsWith(".pdf")) ext = ".pdf";
    else if (lowerName.endsWith(".png")) ext = ".png";
    else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) ext = ".jpg";
    else if (lowerName.endsWith(".webp")) ext = ".webp";
  }

  if (!ext) {
    throw new Error("Unsupported file type. Please upload a PDF, DOC, DOCX, PNG, or JPG file.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 16 * 1024 * 1024) {
    throw new Error("File is too large. Maximum size is 16MB.");
  }

  const safeStem = String(originalName)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 48) || "template";
  const filename = `${safeStem}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(fullPath, buffer);

  return `/uploads/document-templates/${filename}`;
}

export function resolvePublicTemplateUrl(fileUrl, req) {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://") || fileUrl.startsWith("data:")) {
    return fileUrl;
  }
  const host = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  return `${host}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
}
