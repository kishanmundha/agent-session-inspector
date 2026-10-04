import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { ON_HOST } from "@/lib/providers/fs-utils";
import { revealInFileManager } from "@/lib/reveal";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; id: string }> },
) {
  // Opening a window on the user's desktop is not for other sites to trigger.
  const origin = req.headers.get("origin");
  if (origin && URL.parse(origin)?.host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { provider, id } = await params;
  // The path comes from the adapter, never from the request.
  const storagePath = getProvider(provider)?.getSession(id)?.storagePath;
  if (!storagePath) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  // In a container the path is a mount, and there is no desktop to open it on.
  if (!ON_HOST || !(await revealInFileManager(storagePath))) {
    return NextResponse.json({ error: "No file manager available" }, { status: 501 });
  }
  return NextResponse.json({ ok: true });
}
