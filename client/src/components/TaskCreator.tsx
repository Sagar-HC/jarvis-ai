import React, { useState } from 'react';
import { Send, Sparkles, Calendar, Search, Mail, Code, ArrowRight } from 'lucide-react';
import { VoiceController } from './VoiceController';

interface TaskCreatorProps {
  onSubmitTask: (request: string) => Promise<void>;
  loading: boolean;
}

export const TaskCreator: React.FC<TaskCreatorProps> = ({ onSubmitTask, loading }) => {
  const [prompt, setPrompt] = useState('');

  const templates = [
    {
      title: 'Organize Schedule',
      icon: Calendar,
      text: 'Organize my schedule for tomorrow, identify conflicts, and suggest a better arrangement.'
    },
    {
      title: 'Research & Report',
      icon: Search,
      text: 'Research AI agent reliability and deterministic safety, compare reliable sources, prepare a report, and save it in my documents.'
    },
    {
      title: 'Review Project Emails',
      icon: Mail,
      text: 'Review my unread project emails, extract action items, and prepare a prioritized task list.'
    },
    {
      title: 'Inspect Repository',
      icon: Code,
      text: 'Inspect this software repository, verify the tests pass, and report system health.'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    await onSubmitTask(prompt.trim());
    setPrompt('');
  };

  const handleSelectTemplate = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-slate-300 font-medium">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>Command JARVIS with a Natural Goal</span>
          </div>
          <VoiceController onTranscriptReady={(voiceText) => setPrompt(voiceText)} />
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'Organize my schedule for tomorrow and check for conflicts' or 'Inspect repo and run test suite'..."
            rows={3}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition resize-none font-sans"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Preset Template Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-xs text-slate-500 whitespace-nowrap mr-1">Presets:</span>
            {templates.map((tpl, i) => {
              const Icon = tpl.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.text)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs text-slate-300 transition whitespace-nowrap"
                >
                  <Icon className="h-3 w-3 text-cyan-400" />
                  <span>{tpl.title}</span>
                </button>
              );
            })}
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/25 cursor-pointer shrink-0"
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Dispatching...</span>
              </>
            ) : (
              <>
                <span>Execute Goal</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
