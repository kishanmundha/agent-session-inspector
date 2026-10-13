import { NextRequest, NextResponse } from "next/server";
import { getRecord } from "@/lib/providers";

/** One transcript record as stored on disk, uncapped: `?source=` names it. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; id: string }> },
) {
  const { provider, id } = await params;
  const source = req.nextUrl.searchParams.get("source");
  const record = source ? getRecord(provider, id, source) : null;
  if (record === undefined) {
    return NextResponse.json({ error: "Not supported for this provider" }, { status: 501 });
  }
  if (record === null) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  return NextResponse.json({ record });
}
