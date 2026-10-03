import { NextRequest, NextResponse } from "next/server";
import { searchSessions } from "@/lib/search";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const limit = Number(params.get("limit"));
  return NextResponse.json(
    searchSessions(params.get("q") ?? "", {
      project: params.get("project") ?? undefined,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : undefined,
    }),
  );
}
