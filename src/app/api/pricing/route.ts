import { NextRequest, NextResponse } from "next/server";
import { overrideKeyOf, overridePathLabel } from "@/lib/providers/pricing";

/** Where price overrides live and the key each given model needs there. */
export async function GET(req: NextRequest) {
  const models = req.nextUrl.searchParams.getAll("model");
  return NextResponse.json({
    overridePath: overridePathLabel(),
    keys: Object.fromEntries(models.map((model) => [model, overrideKeyOf(model)])),
  });
}
