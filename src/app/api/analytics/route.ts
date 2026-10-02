import { NextResponse } from "next/server";
import { listAnalyticsSessions } from "@/lib/providers";

export async function GET() {
  return NextResponse.json(listAnalyticsSessions());
}
