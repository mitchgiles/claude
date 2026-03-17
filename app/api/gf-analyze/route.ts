import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.GF_API_URL ?? 'http://localhost:8000';

export async function POST(req: NextRequest) {
  const form = await req.formData();

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      body: form,
    });
  } catch {
    return new Response('Could not reach the analysis server.', { status: 502 });
  }

  // Stream the SSE response straight through to the client
  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
