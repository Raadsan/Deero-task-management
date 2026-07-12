import { uploadToS3, deleteFromS3 } from "./s3-client.js";
import path from "path";
import { randomUUID } from "crypto";

export async function saveUserFile(userId, fileData) {
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
  if (buffer.length > 1024 * 1024) {
    throw new Error(`"${name}" must be smaller than 1MB`);
  }

  const ext = path.extname(name) || ".pdf";
  const filename = `users/${userId}/${randomUUID()}${ext}`;
  
  const url = await uploadToS3(filename, buffer, mimeType);

  return {
    url,
    name,
    fileSize: fileSize || buffer.length,
  };
}

export async function deleteUserFileFromDisk(fileUrl) {
  if (!fileUrl) return;
  await deleteFromS3(fileUrl);
}
