import { uploadToS3, deleteFromS3 } from "./s3-client.js";
import path from "path";
import { randomUUID } from "crypto";

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
  const filename = `contracts/${contractId}/${randomUUID()}${ext}`;
  
  const url = await uploadToS3(filename, buffer, mimeType);

  return {
    url,
    name,
    fileSize: fileSize || buffer.length,
    mimeType: mimeType === "application/pdf" ? mimeType : mimeType,
  };
}

export async function deleteContractFileFromDisk(fileUrl) {
  if (!fileUrl) return;
  await deleteFromS3(fileUrl);
}
