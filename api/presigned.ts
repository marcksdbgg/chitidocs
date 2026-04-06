import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { fileName, fileType } = await req.json();

    if (!fileName || !fileType) {
      return new Response(JSON.stringify({ error: 'Missing fileName or fileType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    });

    // URL válida por 60 segundos
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    // Construir la URL pública (usando el dominio personalizado o de R2)
    const publicUrl = `${process.env.VITE_R2_PUBLIC_URL}/${key}`;

    return new Response(JSON.stringify({ uploadUrl, publicUrl, key }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
