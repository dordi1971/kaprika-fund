import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/creator/store";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "MISSING_ADDRESS" }, { status: 400 });
  }

  const nonce = issueNonce(address);
  return NextResponse.json({ nonce });
}

