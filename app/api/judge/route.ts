import { NextResponse } from 'next/server';
import { judge } from '../../../lib/jev';

export async function POST(request: Request) {
  const { promptId, title } = await request.json().catch(() => ({}));
  if (typeof promptId !== 'string' || typeof title !== 'string' || !title || title.length > 200) return NextResponse.json({ correct: false });
  try {
    return NextResponse.json(await judge(request, promptId, title));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'The judge is unreachable' }, { status: 502 });
  }
}
