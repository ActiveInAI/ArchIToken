import { NextResponse } from "next/server";

import { discoverAiProviders } from "@/lib/ai-provider-router";

export const dynamic = "force-dynamic";

export async function GET() {
  const manifest = await discoverAiProviders();
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
