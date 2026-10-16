import { NextRequest, NextResponse } from "next/server";
import { overrideKeyOf, overridePathLabel, priceEntriesOf } from "@/lib/providers/pricing";

/**
 * Where price overrides live, the key each given model needs there, and the
 * entries each is priced with now, keyed the way the override file expects.
 */
export async function GET(req: NextRequest) {
  const models = req.nextUrl.searchParams.getAll("model");
  return NextResponse.json({
    overridePath: overridePathLabel(),
    keys: Object.fromEntries(models.map((model) => [model, overrideKeyOf(model)])),
    prices: Object.fromEntries(
      models.map((model) => {
        const { key, entries } = priceEntriesOf(model);
        return [key, entries];
      }),
    ),
  });
}
