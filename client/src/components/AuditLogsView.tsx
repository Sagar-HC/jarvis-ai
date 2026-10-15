import React from 'react';
import { AuditItem } from '../services/api';
import { Clock, ShieldCheck, DollarSign, Database, Activity } from 'lucide-react';

interface AuditLogsViewProps {
  logs: AuditItem[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  onRefresh: () => void;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, usage, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Observability, Cost Monitoring & Audit Trail</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent logs, step durations, redacted secrets, and estimated inference cost.
          </p>
        </div>
      </div>

      {/* Usage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Total Tokens</span>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {usage?.totalTokens?.toLocaleString() || 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Prompt + Completion</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Prompt Tokens</span>
          <div className="text-xl font-bold font-mono text-blue-400">
            {usage?.promptTokens?.toLocaleString() || 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Input reasoning</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Completion Tokens</span>
          <div className="text-xl font-bold font-mono text-purple-400">
            {usage?.completionTokens?.toLocaleString() || 0}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Output plans & reports</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Estimated Cost</span>
          <div className="text-xl font-bold font-mono text-emerald-400">
            ${(usage?.estimatedCostUsd || 0).toFixed(4)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">USD tracked</span>
        </div>
      </div>

      {/* Audit Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span>Audit Events Stream ({logs?.length || 0})</span>
        </h4>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {logs?.map((log) => {
            let detailsObj = log.details;
            if (typeof log.details === 'string') {
              try { detailsObj = JSON.parse(log.details); } catch {}
            }

            return (
              <div
                key={log.id}
                className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs font-mono space-y-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyan-400 font-semibold">{log.eventType}</span>
                  <div className="flex items-center space-x-2 text-slate-500">
                    <span>Risk L{log.riskLevel}</span>
                    <span>•</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <pre className="text-slate-300 text-[11px] overflow-x-auto whitespace-pre-wrap bg-slate-900/50 p-2 rounded border border-slate-800/40">
                  {JSON.stringify(detailsObj, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
