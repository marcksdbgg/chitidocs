/**
 * Servicio de Almacenamiento (Storage)
 * Conectado a Cloudflare R2 a través de Vercel API
 */
import { auth } from '../firebase';

export async function uploadToR2(file: File): Promise<string> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Debes iniciar sesión para subir archivos');
    }
    const token = await user.getIdToken();

    // 1. Solicitar una Pre-signed URL a nuestra API interna
    const response = await fetch('/api/presigned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Fallo al obtener la URL de subida');
    }

    const { uploadUrl, publicUrl } = await response.json();

    // 2. Subir el archivo directamente a Cloudflare R2 usando la URL firmada
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Fallo al subir el archivo a Cloudflare R2');
    }

    // 3. Retornar la URL pública donde el archivo será accesible
    return publicUrl;
  } catch (error) {
    console.error("Error en uploadToR2:", error);
    throw error;
  }
}
