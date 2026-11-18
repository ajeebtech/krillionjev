import { NextResponse } from 'next/server';
import { match } from '../../../lib/jev';

export async function POST(request: Request) {
  const { promptId, text } = await request.json().catch(() => ({}));
  if (typeof promptId !== 'string' || typeof text !== 'string' || !text.trim() || text.length > 80) return NextResponse.json({ candidate: null });
  try {
    return NextResponse.json({ candidate: await match(request, promptId, text.trim()) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Wikipedia is unreachable' }, { status: 502 });
  }
}
