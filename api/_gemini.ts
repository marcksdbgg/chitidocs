import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ServerDocumentMetadata {
  title?: string;
  type?: string;
  date?: string;
  year?: number;
  month?: number;
  sender?: string;
  recipient?: string;
  studentName?: string;
  teacherName?: string;
  grade?: string;
  section?: string;
  involved?: string[];
  summary?: string;
  isSensitive?: boolean;
  confidence?: number;
  embedding?: number[];
}

export async function analyzeDocumentServer(base64Data: string, mimeType: string, fileName: string): Promise<ServerDocumentMetadata | null> {
  const prompt = `Eres un experto auditor de UGEL y gestión documental en Perú.
Analiza este documento (${fileName}) y extrae la siguiente información técnica para su indexación en una mesa de partes:

1. Título o Asunto.
2. Tipo: "FUT", "Resolución Directoral (RD)", "Memorando", "Oficio", "Informe", "Acta de Evaluación", "Nómina de Matrícula", "Registro de Asistencia", "Otro".
3. Fecha (YYYY-MM-DD si es posible).
4. Año.
5. Mes.
6. Remitente.
7. Destinatario.
8. Estudiante.
9. Docente.
10. Grado.
11. Sección.
12. Involucrados.
13. Resumen (2-3 líneas).
14. Sensibilidad (true/false).
15. Confianza (0 a 1).

Responde estrictamente en formato JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING },
            date: { type: Type.STRING },
            year: { type: Type.INTEGER },
            month: { type: Type.INTEGER },
            sender: { type: Type.STRING },
            recipient: { type: Type.STRING },
            studentName: { type: Type.STRING },
            teacherName: { type: Type.STRING },
            grade: { type: Type.STRING },
            section: { type: Type.STRING },
            involved: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
            isSensitive: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
          },
          required: ['title', 'type', 'summary', 'isSensitive', 'confidence'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}') as ServerDocumentMetadata;
    if (result.summary) {
      const embeddingText = `${result.title ?? ''} ${result.type ?? ''} ${result.summary} ${(result.involved || []).join(' ')}`;
      result.embedding = await generateEmbeddingServer(embeddingText);
    }
    return result;
  } catch (error) {
    console.error('Error analyzing document:', error);
    return null;
  }
}

export async function generateEmbeddingServer(text: string): Promise<number[]> {
  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: text,
    });
    return result.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error('Error generating embedding:', error);
    return [];
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
