import React, { useState } from 'react';
import { ApprovalItem, api } from '../services/api';
import { ShieldAlert, Check, X, AlertTriangle, ArrowRight, Terminal } from 'lucide-react';

interface ApprovalsCenterProps {
  approvals: ApprovalItem[];
  onRefresh: () => void;
}

export const ApprovalsCenter: React.FC<ApprovalsCenterProps> = ({ approvals, onRefresh }) => {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const handleResponse = async (id: string, approved: boolean) => {
    setSubmittingId(id);
    try {
      await api.respondApproval(id, approved, notes[id] || '');
      onRefresh();
    } catch (err) {
      console.error('Error responding to approval:', err);
    } finally {
      setSubmittingId(null);
    }
  };

  if (approvals.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <Check className="h-6 w-6" />
        </div>
        <h4 className="text-base font-medium text-slate-200">No Pending Authorizations</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Autonomous operations are running within authorized risk thresholds. Level 2 and Level 3 consequential actions will queue here for your review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">Human-in-the-Loop Authorizations ({approvals.length})</h3>
        </div>
        <span className="text-xs text-slate-400">Strict deterministic safety enforcement</span>
      </div>

      <div className="space-y-4">
        {approvals.map((req) => {
          let parsedParams = {};
          try {
            parsedParams = JSON.parse(req.proposedParams);
          } catch {
            parsedParams = req.proposedParams;
          }

          return (
            <div
              key={req.id}
              className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      RISK TIER: LEVEL {req.riskLevel}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Tool: <code className="text-cyan-400">{req.toolName}</code>
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-slate-100">{req.actionDescription}</h4>
                  <p className="text-xs text-slate-400">
                    Originating Task: <span className="text-slate-200">"{req.task?.originalRequest}"</span>
                  </p>
                </div>
              </div>

              {/* Parameter Preview */}
              <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Proposed Parameters:
                </span>
                <pre className="text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(parsedParams, null, 2)}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
                <input
                  type="text"
                  placeholder="Optional notes or instructions..."
                  value={notes[req.id] || ''}
                  onChange={(e) => setNotes({ ...notes, [req.id]: e.target.value })}
                  className="w-full sm:w-80 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleResponse(req.id, false)}
                    disabled={submittingId === req.id}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => handleResponse(req.id, true)}
                    disabled={submittingId === req.id}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>Authorize Execution</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
