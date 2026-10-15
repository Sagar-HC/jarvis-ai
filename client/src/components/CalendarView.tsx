import React, { useState, useEffect } from 'react';
import { CalendarEvent, api } from '../services/api';
import { Calendar as CalendarIcon, Clock, Users, Plus, Trash2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

export const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [attendees, setAttendees] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    try {
      const data = await api.getCalendarEvents();
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startTime || !endTime) return;
    setSaving(true);
    try {
      await api.createCalendarEvent({
        title,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        attendees: attendees ? attendees.split(',').map(a => a.trim()) : [],
        description
      });
      setTitle('');
      setStartTime('');
      setEndTime('');
      setAttendees('');
      setDescription('');
      setShowAddModal(false);
      await loadEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Cancel this scheduled meeting?')) {
      await api.deleteCalendarEvent(id);
      await loadEvents();
    }
  };

  const formatEventTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  const formatEventDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
            <CalendarIcon className="h-4 w-4 text-cyan-400" />
            <span>Interactive Calendar & Scheduled Meetings</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            View, inspect, and manage all meetings scheduled by JARVIS or created manually.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl text-xs font-medium shadow-lg shadow-blue-500/20 transition cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Schedule Meeting</span>
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
          Loading your schedule...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CalendarIcon className="h-10 w-10 text-slate-600 mx-auto" />
          <h4 className="text-base font-medium text-slate-300">No Scheduled Meetings</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ask JARVIS to "Organize a meeting with team" or click "Schedule Meeting" above to add one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                      {formatEventDate(evt.startTime)}
                    </span>
                    <h4 className="text-base font-semibold text-slate-100 mt-1.5">{evt.title}</h4>
                  </div>
                  <button
                    onClick={() => handleDelete(evt.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                    title="Cancel meeting"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                  <Clock className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="font-mono">
                    {formatEventTime(evt.startTime)} — {formatEventTime(evt.endTime)}
                  </span>
                </div>

                {evt.description && (
                  <p className="text-xs text-slate-400 font-sans line-clamp-2">
                    {evt.description}
                  </p>
                )}

                {evt.attendees && evt.attendees.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-slate-500 flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>Attendees:</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {evt.attendees.map((att, i) => (
                        <span key={i} className="text-[11px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                          {att}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirmed</span>
                </span>
                <span className="font-mono text-[11px]">ID: {evt.id.slice(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-cyan-400" />
                <span>Schedule a New Meeting</span>
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Strategy Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">End Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Attendees (comma-separated)</label>
                <input
                  type="text"
                  placeholder="team@jarvis.ai, client@partner.com"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Agenda / Description</label>
                <textarea
                  rows={2}
                  placeholder="Goals and meeting agenda..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-medium rounded-xl shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add to Calendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
