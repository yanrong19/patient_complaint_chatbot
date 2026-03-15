"use client";

import { useMemo } from "react";
import { WorkbenchStep, PerformanceMetrics } from "../types";
import WorkbenchGraph from "./WorkbenchGraph";
import MetricsDrawer from "./MetricsDrawer";

interface WorkbenchPanelProps {
  steps: WorkbenchStep[];
  isThinking: boolean;
  metrics: PerformanceMetrics;
}

export default function WorkbenchPanel({
  steps,
  isThinking,
  metrics,
}: WorkbenchPanelProps) {
  // Group steps by turnId, preserving turn order
  const turns = useMemo(() => {
    const groups = new Map<number, WorkbenchStep[]>();
    for (const step of steps) {
      const tid = step.turnId ?? 0;
      if (!groups.has(tid)) groups.set(tid, []);
      groups.get(tid)!.push(step);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [steps]);

  const latestTurnId = turns.length > 0 ? turns[turns.length - 1][0] : null;

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-teal-400 shadow-sm shadow-teal-400/50" />
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
            Agent Workbench
          </h2>
          {isThinking && (
            <span className="text-xs text-cyan-400 flex items-center gap-1.5 ml-auto">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Processing
            </span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Empty state */}
        {turns.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-7 h-7 text-slate-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Agent activity will appear here
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Start a conversation to see the agent workbench in action
            </p>
          </div>
        )}

        {/* One graph per turn */}
        {turns.map(([turnId, turnSteps], index) => {
          const isLatest = turnId === latestTurnId;
          const isLive = isLatest && isThinking;
          const userMsg = turnSteps[0]?.input?.message as string | undefined;

          return (
            <div key={turnId}>
              {/* Separator between turns */}
              {index > 0 && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-slate-700/50" />
                  <span className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold">
                    New Query
                  </span>
                  <div className="flex-1 h-px bg-slate-700/50" />
                </div>
              )}
              <WorkbenchGraph
                steps={turnSteps}
                turnNumber={index + 1}
                userMessage={userMsg}
                isActive={isLive}
              />
            </div>
          );
        })}

        {/* Thinking placeholder when a new turn just started (no steps yet) */}
        {isThinking && turns.length === 0 && (
          <div className="border border-blue-500/30 bg-blue-500/5 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <div>
                <p className="text-sm font-medium text-blue-300">Agent is thinking…</p>
                <p className="text-xs text-slate-500 mt-0.5">Processing your request</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      <MetricsDrawer metrics={metrics} />
    </div>
  );
}
