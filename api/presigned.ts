import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { hasAnyRole, jsonError, requireAuth } from './_auth';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  try {
    const user = await requireAuth(req);
    if (!hasAnyRole(user.role, ['superadmin', 'director', 'subdirector', 'mesa_partes', 'secretaria'])) {
      return jsonError('Forbidden', 403);
    }

    const { fileName, fileType, fileSize } = await req.json();
    if (!fileName || !fileType || typeof fileSize !== 'number') {
      return jsonError('Missing fileName, fileType or fileSize', 400);
    }

    const maxSize = 10 * 1024 * 1024;
    if (fileSize <= 0 || fileSize > maxSize) {
      return jsonError('Invalid file size. Must be between 1 byte and 10MB', 400);
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]);
    if (!allowedMimeTypes.has(fileType)) {
      return jsonError('Unsupported file type', 400);
    }

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    });

    const key = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const bucketName = process.env.R2_BUCKET_NAME || "";
    if (!bucketName) {
      return jsonError('Server storage is not configured', 500);
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
      ContentLength: fileSize,
    });

    // URL válida por 60 segundos
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    // Construir la URL pública (usando el dominio personalizado o de R2)
    const publicBaseUrl = process.env.R2_PUBLIC_URL;
    if (!publicBaseUrl) {
      return jsonError('Storage service is not properly configured', 500);
    }
    const publicUrl = `${publicBaseUrl}/${key}`;

    return new Response(JSON.stringify({ uploadUrl, publicUrl, key }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    const status = (error as any)?.status || 500;
    const message = status === 401 ? 'Unauthorized' : 'Internal server error';
    return jsonError(message, status);
  }
}
