import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const USER_FILES_DIR = path.join(process.cwd(), "uploads", "users");

export async function saveUserFile(userId, fileData) {
  const { name, data, fileSize } = fileData;
  if (!data || typeof data !== "string") {
    throw new Error("Invalid file data");
  }

  const matches = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid file format");
  }

  const buffer = Buffer.from(matches[2], "base64");
  if (buffer.length > 1024 * 1024) {
    throw new Error(`"${name}" must be smaller than 1MB`);
  }

  const ext = path.extname(name) || ".pdf";
  const filename = `${randomUUID()}${ext}`;
  const userDir = path.join(USER_FILES_DIR, userId);
  await fs.mkdir(userDir, { recursive: true });
  await fs.writeFile(path.join(userDir, filename), buffer);

  return {
    url: `/uploads/users/${userId}/${filename}`,
    name,
    fileSize: fileSize || buffer.length,
  };
}

export async function deleteUserFileFromDisk(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/users/")) return;
  const relative = fileUrl.replace(/^\/uploads\//, "");
  const filePath = path.join(process.cwd(), "uploads", relative);
  try {
    await fs.unlink(filePath);
  } catch {
    // file may already be removed
  }
}
