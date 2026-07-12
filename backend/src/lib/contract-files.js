import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const CONTRACT_FILES_DIR = path.join(process.cwd(), "uploads", "contracts");
const MAX_BYTES = 5 * 1024 * 1024;

export async function saveContractFile(contractId, fileData) {
  const { name, data, fileSize } = fileData;
  if (!data || typeof data !== "string") {
    throw new Error("Invalid file data");
  }

  const matches = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid file format");
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], "base64");
  if (buffer.length > MAX_BYTES) {
    throw new Error(`"${name}" must be smaller than 5MB`);
  }

  const allowed =
    mimeType === "application/pdf" ||
    name.toLowerCase().endsWith(".pdf") ||
    mimeType.startsWith("image/");
  if (!allowed) {
    throw new Error("Only PDF or image files are allowed");
  }

  const ext = path.extname(name) || (mimeType === "application/pdf" ? ".pdf" : ".png");
  const filename = `${randomUUID()}${ext}`;
  const contractDir = path.join(CONTRACT_FILES_DIR, contractId);
  await fs.mkdir(contractDir, { recursive: true });
  await fs.writeFile(path.join(contractDir, filename), buffer);

  return {
    url: `/uploads/contracts/${contractId}/${filename}`,
    name,
    fileSize: fileSize || buffer.length,
    mimeType: mimeType === "application/pdf" ? mimeType : mimeType,
  };
}

export async function deleteContractFileFromDisk(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/contracts/")) return;
  const relative = fileUrl.replace(/^\/uploads\//, "");
  const filePath = path.join(process.cwd(), "uploads", relative);
  try {
    await fs.unlink(filePath);
  } catch {
    // file may already be removed
  }
}
