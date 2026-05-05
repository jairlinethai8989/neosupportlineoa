import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

const ALLOWED_SIZES = new Set(['240', '300', '460', '700', '1040', '2080']);

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> }
) {
  const { size } = await context.params;
  if (!ALLOWED_SIZES.has(size)) {
    return NextResponse.json({ error: 'Unsupported imagemap size' }, { status: 404 });
  }

  const IMAGE_PATH = path.join(process.cwd(), 'public', 'line', 'imagemap-portal-menu', `${size}.png`);

  try {
    const imageBuffer = await readFile(IMAGE_PATH);
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Imagemap image read failed', error);
    return NextResponse.json({ error: 'Imagemap image unavailable' }, { status: 500 });
  }
}
