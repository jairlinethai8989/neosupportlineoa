import { NextResponse } from 'next/server';
import { getStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  LEGACY_CHAT_MEDIA_BUCKET,
  normalizeChatMediaObjectPath,
  PRIVATE_CHAT_MEDIA_BUCKET,
} from '@/lib/media/chatMediaPath';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await getStaffAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestedPath = new URL(request.url).searchParams.get('path');
  const path = normalizeChatMediaObjectPath(requestedPath);
  if (!path) {
    return NextResponse.json({ error: 'Invalid media path' }, { status: 400 });
  }

  let { data, error } = await supabaseAdmin.storage
    .from(PRIVATE_CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    ({ data, error } = await supabaseAdmin.storage
      .from(LEGACY_CHAT_MEDIA_BUCKET)
      .createSignedUrl(path, 60));
  }
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  const response = NextResponse.redirect(data.signedUrl, 307);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
