// app/api/local-files/upload/route.ts - Local file upload endpoint
// License: Apache-2.0

import { NextRequest, NextResponse } from 'next/server';
import { normalizeUploadModuleId } from '@/lib/local-file-runtime';
import { saveLocalUpload } from '@/lib/local-file-runtime-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const moduleId = normalizeUploadModuleId(form.get('moduleId'));
  const owner = String(form.get('owner') ?? 'local-user');
  const tags = String(form.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const input = {
    file,
    moduleId,
    owner,
    ...(tags.length > 0 ? { tags } : {}),
  };

  const metadata = await saveLocalUpload(input);

  return NextResponse.json({ file: metadata });
}
