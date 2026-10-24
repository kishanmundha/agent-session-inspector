import { NextRequest, NextResponse } from "next/server";
import { getToolResult } from "@/lib/providers";

/** One tool result and its call, for a Tool output row expanded in place. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const provider = params.get("provider");
  const id = params.get("id");
  const event = params.get("event");
  if (!provider || !id || !event) {
    return NextResponse.json({ error: "provider, id and event are required" }, { status: 400 });
  }
  const found = getToolResult(provider, id, event);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(found);
}
