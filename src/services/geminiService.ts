import { DocumentMetadata } from "../types";
import { auth } from '../firebase';

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión para usar la IA');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<DocumentMetadata | null> {
  try {
    const response = await fetch('/api/analyze-document', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        base64Data,
        mimeType,
        fileName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'No se pudo analizar el documento');
    }

    const data = await response.json();
    return (data.metadata || null) as DocumentMetadata | null;
  } catch (error) {
    console.error("Error analyzing document:", error);
    return null;
  }
}

export async function smartSearchRAG(query: string, documents: any[]): Promise<any[]> {
  try {
    const response = await fetch('/api/search-rag', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        query,
        documents,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'No se pudo ejecutar la búsqueda');
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error in RAG search:", error);
    return [];
  }
}
