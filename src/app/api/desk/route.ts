import { NextResponse } from "next/server";
import { getOnchainDeskProjects } from "@/lib/desk/onchainDesk";
import { isHexAddress } from "@/lib/contracts/helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet") ?? "";

  if (!isHexAddress(wallet)) {
    return NextResponse.json({ error: "BAD_WALLET" }, { status: 400 });
  }

  const projects = await getOnchainDeskProjects(wallet);
  return NextResponse.json({ wallet, projects });
}
