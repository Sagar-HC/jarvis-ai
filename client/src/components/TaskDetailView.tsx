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
  Calendar,
  FileText,
  Mail,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  Users,
  CheckSquare
} from 'lucide-react';

interface TaskDetailViewProps {
  taskId: string;
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ taskId, onRefresh, onNavigateTab }) => {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
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
        <p className="mt-2 text-xs text-slate-400">Loading outcome report...</p>
      </div>
    );
  }

  if (!task) return null;

  const isTerminal = task.status === 'COMPLETED' || task.status === 'CANCELLED';

  // Extract friendly context from the steps
  const calendarStep = task.steps?.find(s => s.toolName.startsWith('calendar.'));
  const fileStep = task.steps?.find(s => s.toolName === 'filesystem.write_file');
  const emailStep = task.steps?.find(s => s.toolName.startsWith('email.'));
  const webStep = task.steps?.find(s => s.toolName.startsWith('web.'));

  // Parse meeting info if calendar action was taken
  let meetingInfo: any = null;
  if (calendarStep) {
    try {
      const input = JSON.parse(calendarStep.inputData || '{}');
      meetingInfo = input;
    } catch {}
  }

  // Parse file write info if document created
  let fileInfo: any = null;
  if (fileStep) {
    try {
      fileInfo = JSON.parse(fileStep.inputData || '{}');
    } catch {}
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
              task.status === 'COMPLETED'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : task.status === 'RUNNING'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse'
                : task.status === 'WAITING_FOR_USER'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-bounce'
                : task.status === 'FAILED'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {task.status.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-slate-100">
            {task.originalRequest}
          </h3>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {!isTerminal && (
            <button
              onClick={handleCancel}
              disabled={actionInProgress}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition cursor-pointer"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {(task.status === 'FAILED' || task.status === 'PARTIALLY_COMPLETED') && (
            <button
              onClick={handleResume}
              disabled={actionInProgress}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Resume</span>
            </button>
          )}
        </div>
      </div>

      {/* Human-Readable Outcome Card */}
      <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-cyan-400 font-medium text-sm">
            <Sparkles className="h-4 w-4" />
            <span>Executive Outcome & Deliverables</span>
          </div>
          {task.status === 'COMPLETED' && (
            <span className="inline-flex items-center space-x-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verified Success</span>
            </span>
          )}
        </div>

        {/* 1. If Meeting Was Scheduled or Calendar Checked */}
        {meetingInfo && (
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider block">
                  Calendar Schedule Detail:
                </span>
                <h4 className="text-base font-semibold text-slate-100">
                  {meetingInfo.title || 'Schedule Analysis & Event'}
                </h4>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('calendar')}
                  className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded-lg text-xs font-medium flex items-center space-x-1 transition cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Open Calendar View</span>
                </button>
              )}
            </div>

            {(meetingInfo.startTime || meetingInfo.endTime) && (
              <div className="flex items-center space-x-2 text-xs text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
                <Clock className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>
                  {meetingInfo.startTime ? new Date(meetingInfo.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                  {meetingInfo.endTime ? ` — ${new Date(meetingInfo.endTime).toLocaleTimeString([], { timeStyle: 'short' })}` : ''}
                </span>
              </div>
            )}

            {meetingInfo.attendees && meetingInfo.attendees.length > 0 && (
              <div className="text-xs text-slate-400 space-y-1">
                <span className="text-[11px] font-mono text-slate-500 flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span>Attendees:</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {meetingInfo.attendees.map((att: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-xs">
                      {att}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. If a Document or File Was Created */}
        {fileInfo && (
          <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-medium text-blue-300">
              <FileText className="h-4 w-4" />
              <span>Generated Document: <code className="text-cyan-300">{fileInfo.path}</code></span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {fileInfo.content || 'Content generated successfully.'}
            </div>
          </div>
        )}

        {/* Plain-English summary if neither */}
        {!meetingInfo && !fileInfo && (
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {task.normalizedObjective || 'Goal processed and verified successfully.'}
          </p>
        )}

        {task.lastError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            <strong>Error:</strong> {task.lastError}
          </div>
        )}
      </div>

      {/* Friendly Action Progress Checklist */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Actions Taken ({task.steps?.length || 0})
        </h4>

        <div className="space-y-2">
          {task.steps?.map((step, idx) => (
            <div
              key={step.id}
              className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-3">
                <span className={`flex h-6 w-6 rounded-full items-center justify-center text-xs font-mono font-bold shrink-0 ${
                  step.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : step.status === 'RUNNING'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse'
                    : step.status === 'FAILED'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {step.status === 'COMPLETED' ? '✓' : idx + 1}
                </span>

                <div>
                  <span className="font-medium text-slate-200">{step.title}</span>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {step.toolName} • Risk Tier: Level {step.riskLevel}
                  </div>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                step.status === 'COMPLETED'
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                  : step.status === 'RUNNING'
                  ? 'text-blue-400 bg-blue-500/10 animate-pulse'
                  : step.status === 'FAILED'
                  ? 'text-rose-400 bg-rose-500/10'
                  : 'text-slate-500'
              }`}>
                {step.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Technical Details (Collapsible) */}
      <div className="border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-200 font-mono py-1 transition cursor-pointer"
        >
          <span>Advanced Technical Audit & Verification Data</span>
          {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showTechnicalDetails && (
          <div className="mt-3 space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono animate-fadeIn">
            <div>
              <span className="text-slate-500 block mb-1">Normalized Objective:</span>
              <p className="text-slate-300 font-sans">{task.normalizedObjective}</p>
            </div>

            <div>
              <span className="text-slate-500 block mb-1">Independent Verification Verdicts:</span>
              <div className="space-y-1">
                {task.verifications?.map((v, i) => (
                  <div key={i} className="p-2 bg-slate-900 rounded border border-slate-800 flex justify-between">
                    <span className="text-emerald-400">{v.verdict}</span>
                    <span className="text-slate-400 truncate max-w-xs">{v.reasoning}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-slate-500 block mb-1">Raw Action Evidence:</span>
              <div className="space-y-1">
                {task.actionResults?.map((r, i) => (
                  <pre key={i} className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                    {r.actualOutcome || r.actionTaken}
                  </pre>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
