"use client";

import dynamic from "next/dynamic";

const ChatApp = dynamic(() => import("./ChatApp"), {
  ssr: false,
  loading: () => <div className="h-screen bg-slate-50" />,
});

export default function ChatAppLoader() {
  return <ChatApp />;
}
