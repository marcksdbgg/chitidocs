import { cosineSimilarity, generateEmbeddingServer } from './_gemini';
import { jsonError, requireAuth } from './_auth';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  try {
    await requireAuth(req);

    const { query, documents } = await req.json();
    if (!query || !Array.isArray(documents)) {
      return jsonError('Missing query or documents', 400);
    }

    const queryEmbedding = await generateEmbeddingServer(query);
    if (!queryEmbedding.length) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const threshold = 0.4;
    const results = documents
      .map((doc: any) => {
        const docEmbedding = doc?.metadata?.embedding;
        const score = Array.isArray(docEmbedding) ? cosineSimilarity(queryEmbedding, docEmbedding) : 0;
        return { ...doc, score };
      })
      .filter((doc: any) => doc.score > threshold)
      .sort((a: any, b: any) => b.score - a.score);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = status === 401 ? 'Unauthorized' : 'Internal server error';
    return jsonError(message, status);
  }
}
