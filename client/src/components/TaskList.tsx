import React from 'react';
import { TaskSummary } from '../services/api';
import { CheckCircle2, Clock, AlertTriangle, XCircle, ArrowRight, ShieldAlert, Play, Pause } from 'lucide-react';

interface TaskListProps {
  tasks: TaskSummary[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, selectedTaskId, onSelectTask }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            <span>COMPLETED</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            <Play className="h-3 w-3" />
            <span>RUNNING</span>
          </span>
        );
      case 'VERIFYING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 animate-pulse">
            <Clock className="h-3 w-3" />
            <span>VERIFYING</span>
          </span>
        );
      case 'WAITING_FOR_USER':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-bounce">
            <ShieldAlert className="h-3 w-3" />
            <span>WAITING USER</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="h-3 w-3" />
            <span>FAILED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/40 text-slate-400 border border-slate-600/30">
            <Pause className="h-3 w-3" />
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Clock className="h-3 w-3" />
            <span>{status}</span>
          </span>
        );
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <p className="text-sm">No tasks dispatched yet. Use the command bar above to start a goal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const isSelected = selectedTaskId === task.id;
        const totalSteps = task.steps?.length || 0;
        const completedSteps = task.steps?.filter(s => s.status === 'COMPLETED').length || 0;
        const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        return (
          <div
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
              isSelected
                ? 'bg-slate-800/90 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  {getStatusBadge(task.status)}
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-slate-200 truncate">
                  {task.originalRequest}
                </h4>
              </div>
              <ArrowRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-blue-400 translate-x-1' : 'text-slate-600'}`} />
            </div>

            {totalSteps > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2 flex-1 max-w-xs mr-4">
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">{progressPct}%</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {completedSteps}/{totalSteps} steps
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
