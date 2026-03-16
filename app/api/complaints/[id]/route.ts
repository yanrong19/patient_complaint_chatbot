import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { deleteComplaint } from "../../../lib/store";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteComplaint(id, userId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found or not authorised" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
