import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const PREFIX = process.env.AWS_S3_UPLOAD_PREFIX || "Task_management_uploads";

export async function uploadToS3(key, buffer, contentType) {
  // Ensure the prefix doesn't end with a slash and key doesn't start with one to prevent double slashes
  const cleanPrefix = PREFIX.endsWith('/') ? PREFIX.slice(0, -1) : PREFIX;
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  const fullKey = `${cleanPrefix}/${cleanKey}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fullKey,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "eu-north-1"}.amazonaws.com/${fullKey}`;
}

export async function deleteFromS3(url) {
  if (!url || !url.includes('amazonaws.com')) return;
  
  try {
    const urlObj = new URL(url);
    // Remove the leading slash from the pathname
    const fullKey = urlObj.pathname.slice(1);
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fullKey,
    });
    
    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting from S3:", error);
  }
}
