import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";
import { redirect } from "next/navigation";
import { getComplaintsByUser } from "../lib/store";
import ComplaintsClient from "./ComplaintsClient";

export default async function ComplaintsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id?: string }).id;
  if (!userId) redirect("/login");

  const complaints = await getComplaintsByUser(userId);

  return <ComplaintsClient complaints={complaints} userName={session.user.name ?? "Patient"} />;
}
