import { getServerSession } from "next-auth";
import { authOptions } from "./lib/auth";
import { redirect } from "next/navigation";
import ChatAppLoader from "./components/ChatAppLoader";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return <ChatAppLoader />;
}
