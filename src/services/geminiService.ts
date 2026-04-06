import { GoogleGenAI, Type } from "@google/genai";
import { DocumentMetadata } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<DocumentMetadata | null> {
  const model = "gemini-3-flash-preview"; // Fast, cheap, multimodal OCR
  
  const prompt = `Eres un experto auditor de UGEL y gestión documental en Perú.
  Analiza este documento (${fileName}) y extrae la siguiente información técnica para su indexación en una mesa de partes:
  
  1. Título o Asunto: El tema principal del documento.
  2. Tipo: DEBE ser estrictamente una de estas categorías: "FUT", "Resolución Directoral (RD)", "Memorando", "Oficio", "Informe", "Acta de Evaluación", "Nómina de Matrícula", "Registro de Asistencia", "Otro".
  3. Fecha: La fecha de emisión o referencia en el documento (formato YYYY-MM-DD si es posible).
  4. Año: El año de emisión del documento.
  5. Mes: El mes de emisión del documento (1-12).
  6. Remitente: Persona o institución que envía el documento.
  7. Destinatario: Persona o institución a quien va dirigido.
  8. Estudiante: Nombre del estudiante mencionado (si aplica).
  9. Docente: Nombre del docente mencionado (si aplica).
  10. Grado: Grado escolar mencionado (si aplica).
  11. Sección: Sección escolar mencionada (si aplica).
  12. Involucrados: Lista de nombres de personas, docentes, alumnos o instituciones mencionadas.
  13. Resumen: Un resumen técnico de 2-3 líneas para búsqueda semántica vectorial.
  14. Sensibilidad: true si contiene DNI, datos médicos, bancarios, notas de alumnos o direcciones privadas. false en caso contrario.
  15. Confianza: Un valor de 0 a 1 indicando qué tan seguro estás de la extracción.

  Responde estrictamente en formato JSON.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
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
            confidence: { type: Type.NUMBER }
          },
          required: ["title", "type", "summary", "isSensitive", "confidence"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}") as DocumentMetadata;
    
    // Generar embedding para RAG
    if (result.summary) {
      const embeddingText = `${result.title} ${result.type} ${result.summary} ${result.involved?.join(' ')}`;
      result.embedding = await generateEmbedding(embeddingText);
    }

    return result;
  } catch (error) {
    console.error("Error analyzing document:", error);
    return null;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: text,
    });
    return result.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error("Error generating embedding:", error);
    return [];
  }
}

// Función matemática para calcular la similitud del coseno entre dos vectores
function cosineSimilarity(vecA: number[], vecB: number[]): number {
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

export async function smartSearchRAG(query: string, documents: any[]): Promise<any[]> {
  try {
    // 1. Generar el vector (embedding) de la consulta del usuario
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding.length) return [];

    // 2. Calcular la similitud del coseno contra todos los documentos en la base de datos
    const scoredDocs = documents.map(doc => {
      const docEmbedding = doc.metadata?.embedding;
      const score = docEmbedding ? cosineSimilarity(queryEmbedding, docEmbedding) : 0;
      return { ...doc, score };
    });

    // 3. Ordenar por relevancia (score más alto primero) y filtrar los que tienen un score mínimo
    const threshold = 0.4; // Ajustable según pruebas
    const results = scoredDocs
      .filter(doc => doc.score > threshold)
      .sort((a, b) => b.score - a.score);

    return results;
  } catch (error) {
    console.error("Error in RAG search:", error);
    return [];
  }
}
