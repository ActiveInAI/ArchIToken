// app/api/local-files/route.ts - Local file index endpoint
// License: Apache-2.0

import { NextRequest, NextResponse } from 'next/server';
import { readLocalFileIndex } from '@/lib/local-file-runtime-server';
import { normalizeModuleId } from '@/lib/module-registry';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const moduleId = normalizeModuleId(
    request.nextUrl.searchParams.get('moduleId') ?? '',
  );
  const index = await readLocalFileIndex();

  return NextResponse.json({
    files: moduleId
      ? index.files.filter((file) => file.moduleId === moduleId)
      : index.files,
  });
}
