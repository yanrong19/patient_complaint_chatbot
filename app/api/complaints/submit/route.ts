import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { persistComplaint } from "../../../lib/store";
import { Complaint } from "../../../types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const complaint = (await req.json()) as Complaint;
  if (!complaint?.complaint_id) {
    return NextResponse.json({ error: "Invalid complaint data." }, { status: 400 });
  }

  await persistComplaint(complaint, userId);
  return NextResponse.json({ success: true });
}
