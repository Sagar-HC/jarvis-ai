import React, { useEffect, useState } from 'react';
import { api, TaskDetail } from '../services/api';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ShieldAlert,
  Play,
  RotateCcw,
  Ban,
  Terminal,
  Activity,
  FileCheck2,
  Layers,
  Sparkles
} from 'lucide-react';

interface TaskDetailViewProps {
  taskId: string;
  onRefresh: () => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ taskId, onRefresh }) => {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);

  const loadTask = async () => {
    try {
      const data = await api.getTask(taskId);
      setTask(data);
    } catch (err) {
      console.error('Error fetching task details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
    const interval = setInterval(loadTask, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleCancel = async () => {
    if (!task) return;
    setActionInProgress(true);
    try {
      await api.cancelTask(task.id, 'User clicked Cancel');
      await loadTask();
      onRefresh();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleResume = async () => {
    if (!task) return;
    setActionInProgress(true);
    try {
      await api.resumeTask(task.id);
      await loadTask();
      onRefresh();
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading && !task) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <span className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full inline-block" />
        <p className="mt-2 text-xs text-slate-400">Loading task execution graph...</p>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const isTerminal = task.status === 'COMPLETED' || task.status === 'CANCELLED';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-blue-400 bg-blue-950/80 border border-blue-800 px-2 py-0.5 rounded">
              ID: {task.id.slice(0, 8)}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Risk Tier: Level {task.riskLevel}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-100 mt-1">
            {task.originalRequest}
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          {!isTerminal && (
            <button
              onClick={handleCancel}
              disabled={actionInProgress}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition cursor-pointer"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>Cancel Task</span>
            </button>
          )}

          {(task.status === 'FAILED' || task.status === 'PARTIALLY_COMPLETED') && (
            <button
              onClick={handleResume}
              disabled={actionInProgress}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Resume Execution</span>
            </button>
          )}
        </div>
      </div>

      {/* Normalized Objective & Criteria */}
      {task.normalizedObjective && (
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center space-x-2 text-cyan-400 font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Normalized Objective (Intent Agent)</span>
          </div>
          <p className="text-slate-300 font-sans">{task.normalizedObjective}</p>
          {task.lastError && (
            <p className="text-rose-400 font-mono text-[11px] bg-rose-950/40 border border-rose-900/60 p-2 rounded">
              Error: {task.lastError}
            </p>
          )}
        </div>
      )}

      {/* Step DAG Timeline */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Layers className="h-4 w-4 text-blue-400" />
          <span>Execution Graph ({task.steps.length} Steps)</span>
        </div>

        <div className="space-y-3">
          {task.steps.map((step, idx) => {
            const stepResult = task.actionResults?.find(r => r.stepId.endsWith(step.id.split('_').pop()!));
            const stepVerification = task.verifications?.find(v => v.stepId.endsWith(step.id.split('_').pop()!));

            return (
              <div
                key={step.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                {/* Step Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <span className="flex h-6 w-6 rounded-full bg-slate-800 border border-slate-700 items-center justify-center text-xs font-mono text-slate-300 shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h5 className="text-sm font-medium text-slate-200">{step.title}</h5>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                        <span className="font-mono text-cyan-400">{step.toolName}</span>
                        <span>•</span>
                        <span>Risk: Level {step.riskLevel}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                    step.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : step.status === 'RUNNING'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse'
                      : step.status === 'WAITING_APPROVAL'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-bounce'
                      : step.status === 'FAILED'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {step.status}
                  </span>
                </div>

                {/* Preconditions & Postconditions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  <div>
                    <span className="text-slate-500">Precondition: </span>
                    <span>{step.preconditions || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Expected Postcondition: </span>
                    <span className="text-slate-300">{step.postconditions || 'Operational output verified'}</span>
                  </div>
                </div>

                {/* Structured Action Result Evidence */}
                {stepResult && (
                  <div className="border-t border-slate-800/60 pt-2 text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                      <Activity className="h-3.5 w-3.5 text-blue-400" />
                      <span>Action Output & Evidence</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded text-xs font-mono text-slate-300 overflow-x-auto">
                      {stepResult.actualOutcome || stepResult.actionTaken}
                    </div>
                  </div>
                )}

                {/* Independent Verification Verdict */}
                {stepVerification && (
                  <div className="border-t border-slate-800/60 pt-2 text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                      <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Independent Verification Result</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800 text-xs">
                      <span className="text-emerald-400 font-mono font-medium">{stepVerification.verdict}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{stepVerification.reasoning}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
