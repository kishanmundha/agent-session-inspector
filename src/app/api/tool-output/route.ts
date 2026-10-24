import { NextRequest, NextResponse } from "next/server";
import { listToolResults } from "@/lib/providers";

/** Every result behind one row of the Analytics tab's Tool output table. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tool = params.get("tool");
  if (!tool) return NextResponse.json({ error: "tool is required" }, { status: 400 });
  const from = Number(params.get("from"));
  const limit = Number(params.get("limit"));
  return NextResponse.json(
    listToolResults({
      tool,
      command: params.get("command") ?? undefined,
      from: params.has("from") && Number.isFinite(from) ? from : null,
      provider: params.get("provider") ?? "all",
      project: params.get("project") ?? "all",
      model: params.get("model") ?? "all",
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 200,
      ...(params.get("sessionProvider") && params.get("sessionId")
        ? { session: { provider: params.get("sessionProvider")!, id: params.get("sessionId")! } }
        : {}),
    }),
  );
}
