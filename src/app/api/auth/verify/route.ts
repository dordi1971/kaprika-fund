import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recoverMessageAddress } from "viem";
import { consumeNonce, createSession } from "@/lib/creator/store";
import { SESSION_COOKIE } from "@/lib/creator/auth";

type Body = {
  address?: string;
  signature?: `0x${string}` | string;
  nonce?: string;
};

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const address = body?.address?.trim();
  const signature = body?.signature;
  const nonce = body?.nonce?.trim();

  if (!address || !signature || !nonce) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const validNonce = consumeNonce(address, nonce);
  if (!validNonce) {
    return NextResponse.json({ ok: false, error: "NONCE_INVALID" }, { status: 400 });
  }

  let recovered: string;
  try {
    recovered = await recoverMessageAddress({
      message: nonce,
      signature: signature as `0x${string}`,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "SIGNATURE_INVALID" }, { status: 400 });
  }

  if (normalizeAddress(recovered) !== normalizeAddress(address)) {
    return NextResponse.json({ ok: false, error: "ADDRESS_MISMATCH" }, { status: 400 });
  }

  const token = createSession(address);
  const cookieJar = await cookies();
  cookieJar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({ ok: true });
}

