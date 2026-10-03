import { NextRequest, NextResponse } from "next/server";
import { getSession, probeSession } from "@/lib/providers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; id: string }> },
) {
  const { provider, id } = await params;
  // `?probe=1` answers "has it changed?" without shipping the whole transcript.
  const session = req.nextUrl.searchParams.has("probe")
    ? probeSession(provider, id)
    : getSession(provider, id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}
