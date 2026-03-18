"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Complaint } from "../types";

const STATUS_CONFIG = {
  received:     { label: "Received",     color: "text-blue-700",  bg: "bg-blue-100"  },
  under_review: { label: "Under Review", color: "text-amber-700", bg: "bg-amber-100" },
  resolved:     { label: "Resolved",     color: "text-green-700", bg: "bg-green-100" },
} as const;

const URGENCY_CONFIG = {
  low:    { label: "Low",    color: "text-slate-500", dot: "bg-slate-400" },
  medium: { label: "Medium", color: "text-amber-700", dot: "bg-amber-500" },
  high:   { label: "High",   color: "text-red-700",   dot: "bg-red-500"   },
} as const;

const TYPE_ICON: Record<string, string> = {
  billing: "💳", clinical: "🏥", staff: "👥", facility: "🏢", other: "📋",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch { return iso; }
}

function ComplaintRow({
  complaint,
  onDelete,
}: {
  complaint: Complaint;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const status = STATUS_CONFIG[complaint.status] ?? STATUS_CONFIG.received;
  const urgency = URGENCY_CONFIG[complaint.urgency as keyof typeof URGENCY_CONFIG] ?? URGENCY_CONFIG.medium;
  const icon = TYPE_ICON[complaint.complaint_type] ?? "📋";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.complaint_id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete(complaint.complaint_id);
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-gray-300 transition-colors">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Expand toggle — takes most of the row */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <span className="text-xl flex-shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-blue-600">{complaint.complaint_id}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}>
                {status.label}
              </span>
              {complaint.escalated && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                  Escalated
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{complaint.description}</p>
          </div>
        </button>

        {/* Right side: date + urgency + delete + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400">{formatDate(complaint.created_at)}</p>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${urgency.dot}`} />
              <span className={`text-[9px] font-semibold ${urgency.color}`}>{urgency.label}</span>
            </div>
          </div>

          {/* Delete button */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Remove complaint"
              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Remove?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
              >
                {deleting ? "…" : "Yes"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-600 transition-colors"
              >
                No
              </button>
            </div>
          )}

          {/* Chevron */}
          <button onClick={() => setExpanded((v) => !v)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
            {[
              ["Patient", complaint.patient_name],
              ["Type", complaint.complaint_type],
              ["Assigned To", complaint.assigned_team],
              ["Urgency", urgency.label],
              ["Filed", formatDate(complaint.created_at)],
              ["Last Updated", formatDate(complaint.last_updated)],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium w-20 flex-shrink-0 pt-0.5">{label}</span>
                <span className="text-xs text-slate-700 capitalize">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium w-20 flex-shrink-0 pt-0.5">Description</span>
            <span className="text-xs text-slate-700">{complaint.description}</span>
          </div>
          {complaint.escalated && complaint.escalation_reason && (
            <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-0.5">Escalation Reason</p>
              <p className="text-xs text-slate-600">{complaint.escalation_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComplaintsClient({
  complaints: initialComplaints,
  userName,
}: {
  complaints: Complaint[];
  userName: string;
}) {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);

  const handleDelete = (id: string) => {
    setComplaints((prev) => prev.filter((c) => c.complaint_id !== id));
  };

  const total = complaints.length;
  const open = complaints.filter((c) => c.status !== "resolved").length;
  const escalated = complaints.filter((c) => c.escalated).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      {/* Nav */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏥</span>
            <span className="text-sm font-bold text-slate-800">Kira AI</span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-slate-500">My Complaints</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              ← Back to Chat
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Complaint History</h1>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as <span className="text-slate-700">{userName}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Filed",  value: total,     color: "text-slate-800", bg: "bg-white",        border: "border-gray-200"      },
            { label: "Open",         value: open,      color: "text-amber-700", bg: "bg-amber-50",     border: "border-amber-200"     },
            { label: "Escalated",    value: escalated, color: "text-red-700",   bg: "bg-red-50",       border: "border-red-200"       },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {complaints.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-500 font-medium">No complaints yet</p>
            <p className="text-sm text-slate-400 mt-1">Use the chatbot to report an issue — it will appear here.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Go to Chat
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {complaints.map((c) => (
              <ComplaintRow key={c.complaint_id} complaint={c} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
