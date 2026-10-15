import React, { useState } from 'react';
import { MemoryItem, api } from '../services/api';
import { Brain, Trash2, Plus, ShieldCheck, Tag } from 'lucide-react';

interface MemoryCenterProps {
  memories: MemoryItem[];
  onRefresh: () => void;
}

export const MemoryCenter: React.FC<MemoryCenterProps> = ({ memories, onRefresh }) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('PREFERENCE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;
    setIsSubmitting(true);
    try {
      await api.addMemory({ key: key.trim(), value: value.trim(), category });
      setKey('');
      setValue('');
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (k: string) => {
    if (confirm(`Purge memory for '${k}'?`)) {
      await api.deleteMemory(k);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">User-Approved Long-Term Memory & Privacy Controls</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuity across sessions with transparent inspection, correction, and deletion. Secrets are automatically redacted.
          </p>
        </div>
      </div>

      {/* Add Memory Form */}
      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
          <Plus className="h-4 w-4 text-cyan-400" />
          <span>Add User Preference or Context</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="PREFERENCE">User Preference</option>
            <option value="PROJECT_CONTEXT">Project Context</option>
            <option value="HISTORICAL_RESULT">Verified Result</option>
            <option value="CAPABILITY_METADATA">Capability Metadata</option>
          </select>

          <input
            type="text"
            placeholder="Key (e.g. preferred_meeting_duration)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <input
            type="text"
            placeholder="Value (e.g. 30 minutes with 5 min buffer)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!key.trim() || !value.trim() || isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition shadow-md shadow-blue-600/20 disabled:opacity-40"
          >
            Save Memory
          </button>
        </div>
      </form>

      {/* Memory Records List */}
      <div className="space-y-3">
        {memories.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
            No memories stored yet. Add preferences above or let JARVIS remember verified task outcomes.
          </div>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    {m.category}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-200">{m.key}</span>
                </div>
                <p className="text-xs text-slate-300 font-sans">{m.value}</p>
                <span className="text-[10px] text-slate-500 font-mono block">
                  Updated: {new Date(m.updatedAt).toLocaleString()}
                </span>
              </div>

              <button
                onClick={() => handleDelete(m.key)}
                className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                title="Purge record"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
