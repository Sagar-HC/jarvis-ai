import React, { useState } from 'react';
import { ScheduleItem, api } from '../services/api';
import { Calendar, Clock, Plus, Play, Sparkles } from 'lucide-react';

interface SchedulesViewProps {
  schedules: ScheduleItem[];
  onRefresh: () => void;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({ schedules, onRefresh }) => {
  const [name, setName] = useState('');
  const [naturalSchedule, setNaturalSchedule] = useState('Every morning at 8:00 AM');
  const [prompt, setPrompt] = useState('Summarize my schedule and outstanding tasks for today.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createSchedule({ name: name.trim(), naturalSchedule, prompt: prompt.trim() });
      setName('');
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Scheduled & User-Authorized Proactive Tasks</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Durable recurring jobs executing with the identical safety, authorization, and verification pipeline.
          </p>
        </div>
      </div>

      {/* New Schedule Form */}
      <form onSubmit={handleRegister} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
          <Plus className="h-4 w-4 text-cyan-400" />
          <span>Register Proactive Schedule</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Schedule Name (e.g. Daily Morning Briefing)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <input
            type="text"
            placeholder="Schedule (e.g. Every day at 8:00 AM)"
            value={naturalSchedule}
            onChange={(e) => setNaturalSchedule(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <input
            type="text"
            placeholder="Goal prompt to execute"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!name.trim() || !prompt.trim() || isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-40"
          >
            Activate Schedule
          </button>
        </div>
      </form>

      {/* List */}
      <div className="space-y-3">
        {schedules.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
            No proactive schedules active. Add one above to automate recurring summaries or checks.
          </div>
        ) : (
          schedules.map((s) => (
            <div
              key={s.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {s.status}
                  </span>
                  <span className="font-semibold text-xs text-slate-200">{s.name}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{s.naturalSchedule}</span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-slate-500">Cron: {s.cronExpression}</span>
                </div>
                {s.nextRunAt && (
                  <span className="text-[10px] text-slate-500 font-mono block">
                    Next run scheduled: {new Date(s.nextRunAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
