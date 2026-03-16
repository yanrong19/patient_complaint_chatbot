"use client";

import { useState, useEffect } from "react";
import { Complaint, ComplaintStatus, UrgencyLevel } from "../types";

interface ComplaintCardProps {
  complaint: Complaint;
}

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; bg: string }> = {
  received:     { label: "Received",     color: "text-blue-400",   bg: "bg-blue-500/15"   },
  under_review: { label: "Under Review", color: "text-amber-400",  bg: "bg-amber-500/15"  },
  resolved:     { label: "Resolved",     color: "text-green-400",  bg: "bg-green-500/15"  },
};

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; dot: string }> = {
  low:    { label: "Low",    color: "text-slate-400",  dot: "bg-slate-400"  },
  medium: { label: "Medium", color: "text-amber-400",  dot: "bg-amber-400"  },
  high:   { label: "High",   color: "text-red-400",    dot: "bg-red-400"    },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return iso;
  }
}

function isComplaintSubmitted(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = sessionStorage.getItem("kira-submitted-complaints");
    return saved ? (JSON.parse(saved) as string[]).includes(id) : false;
  } catch { return false; }
}

function markComplaintSubmitted(id: string) {
  try {
    const saved = sessionStorage.getItem("kira-submitted-complaints");
    const ids: string[] = saved ? JSON.parse(saved) : [];
    if (!ids.includes(id)) ids.push(id);
    sessionStorage.setItem("kira-submitted-complaints", JSON.stringify(ids));
  } catch {}
}

export default function ComplaintCard({ complaint }: ComplaintCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (isComplaintSubmitted(complaint.complaint_id)) setSubmitted(true);
  }, [complaint.complaint_id]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const status = STATUS_CONFIG[complaint.status] ?? STATUS_CONFIG.received;
  const urgency = URGENCY_CONFIG[complaint.urgency] ?? URGENCY_CONFIG.medium;

  // ── Submitted confirmation state ─────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="w-4 h-4 text-green-400 flex-shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-green-400">Complaint Submitted</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Reference: <span className="font-mono text-green-300">{complaint.complaint_id}</span> · {complaint.assigned_team} will follow up
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Draft / pending state ─────────────────────────────────────────────────
  return (
    <div className="mt-3 rounded-xl border border-cyan-500/25 bg-slate-900/80 overflow-hidden text-left">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/60 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="w-4 h-4 text-cyan-400">
            <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 10Zm.75 2.25a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-cyan-300 font-mono">{complaint.complaint_id}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{complaint.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${urgency.dot}`} />
            <span className={`text-[9px] font-semibold ${urgency.color}`}>{urgency.label}</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
            <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25Z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/40 space-y-2">
          <Row label="Patient"      value={complaint.patient_name} />
          <Row label="Type"         value={complaint.complaint_type} capitalize />
          <Row label="Assigned To"  value={complaint.assigned_team} />
          <Row label="Description"  value={complaint.description} multiline />
          <Row label="Logged"       value={formatDate(complaint.created_at)} />
          {complaint.escalated && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-0.5">Escalated</p>
              {complaint.escalation_reason && (
                <p className="text-xs text-slate-300">{complaint.escalation_reason}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit footer */}
      <div className="px-3 py-2.5 border-t border-slate-700/40 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-500">
            Would you like to formally submit this complaint?
          </p>
          <button
            onClick={async () => {
              setSubmitError("");
              setSubmitting(true);
              try {
                const res = await fetch("/api/complaints/submit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(complaint),
                });
                if (!res.ok) throw new Error("Submission failed.");
                markComplaintSubmitted(complaint.complaint_id);
                setSubmitted(true);
              } catch {
                setSubmitError("Could not submit. Please try again.");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Complaint"}
          </button>
        </div>
        {submitError && (
          <p className="text-[10px] text-red-400">{submitError}</p>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, capitalize, multiline,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-[9px] text-slate-500 uppercase tracking-wide font-medium w-20 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-xs text-slate-200 flex-1 ${capitalize ? "capitalize" : ""} ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>
        {value}
      </span>
    </div>
  );
}
