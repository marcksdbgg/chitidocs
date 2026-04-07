import { analyzeDocumentServer } from './_gemini';
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

    const { base64Data, mimeType, fileName } = await req.json();
    if (!base64Data || !mimeType || !fileName) {
      return jsonError('Missing base64Data, mimeType or fileName', 400);
    }

    const metadata = await analyzeDocumentServer(base64Data, mimeType, fileName);
    return new Response(JSON.stringify({ metadata }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = status === 401 ? 'Unauthorized' : 'Internal server error';
    return jsonError(message, status);
  }
}
