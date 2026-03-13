import { getAuthUrl } from '@/lib/spotify';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
