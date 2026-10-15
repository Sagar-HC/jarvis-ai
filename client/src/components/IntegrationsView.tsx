import React, { useState } from 'react';
import { IntegrationItem, api } from '../services/api';
import { CheckCircle2, AlertCircle, XCircle, Settings2, ShieldCheck, ExternalLink, Sparkles, X, Key, Check } from 'lucide-react';

interface IntegrationsViewProps {
  integrations: IntegrationItem[];
  onRefresh: () => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ integrations, onRefresh }) => {
  const [activeModalItem, setActiveModalItem] = useState<IntegrationItem | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const openConfig = (item: IntegrationItem) => {
    setActiveModalItem(item);
    setFormData({});
    setFeedback(null);
  };

  const closeConfig = () => {
    setActiveModalItem(null);
    setFormData({});
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalItem) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await api.connectIntegration(activeModalItem.providerId, formData);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Connected successfully!' });
        setTimeout(() => {
          onRefresh();
          closeConfig();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Connection failed. Please check credentials.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error while connecting.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeModalItem) return;
    setSaving(true);
    try {
      await api.disconnectIntegration(activeModalItem.providerId);
      setFeedback({ type: 'success', message: 'Provider disconnected.' });
      setTimeout(() => {
        onRefresh();
        closeConfig();
      }, 1000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Application Connectors & Capability Discovery</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent status, least-privilege scopes, and explicit labeling of live vs simulated providers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => {
          const isConnected = item.health.status === 'CONNECTED';
          const isConfigRequired = item.health.status === 'CONFIG_REQUIRED';

          return (
            <div
              key={item.providerId}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-100">{item.name}</h4>
                    <span className="text-xs text-slate-500 font-mono">{item.providerId}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Honest Simulation Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      item.isSimulated
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {item.isSimulated ? 'SIMULATED' : 'LIVE API'}
                    </span>

                    {/* Health Status */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      isConnected
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : isConfigRequired
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {item.health.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                  {item.health.message}
                </p>

                {/* Capabilities */}
                <div className="mt-3 space-y-1.5">
                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
                    Supported Capabilities ({item.capabilities?.length || 0}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.capabilities?.map((cap) => (
                      <span
                        key={cap.name}
                        className="px-2 py-0.5 bg-slate-800/80 border border-slate-700/60 rounded text-[11px] font-mono text-slate-300"
                      >
                        {cap.name} (L{cap.riskLevel})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Verified: {new Date(item.health.checkedAt).toLocaleTimeString()}</span>
                <button
                  type="button"
                  onClick={() => openConfig(item)}
                  className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Configure</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Configuration Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-slate-100">{activeModalItem.name}</h4>
                  <span className="text-xs text-slate-500 font-mono">Provider: {activeModalItem.providerId}</span>
                </div>
              </div>
              <button
                onClick={closeConfig}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {feedback && (
              <div className={`p-3 rounded-xl text-xs font-mono flex items-center space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}>
                {feedback.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {activeModalItem.providerId === 'WEB_SEARCH' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Tavily / SerpAPI Key</label>
                  <input
                    type="password"
                    placeholder="tvly-..."
                    value={formData.apiKey || ''}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500">Provide an API key for live internet search queries and real-time crawling.</p>
                </div>
              )}

              {activeModalItem.providerId === 'GOOGLE_CALENDAR' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Google OAuth Client ID</label>
                    <input
                      type="text"
                      placeholder="...apps.googleusercontent.com"
                      value={formData.clientId || ''}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Google OAuth Client Secret</label>
                    <input
                      type="password"
                      placeholder="GOCSPX-..."
                      value={formData.clientSecret || ''}
                      onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">Currently operates with authoritative local calendar storage. Connect credentials for Google Calendar synchronization.</p>
                </div>
              )}

              {activeModalItem.providerId === 'GMAIL' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Gmail OAuth Refresh Token or SMTP Password</label>
                    <input
                      type="password"
                      placeholder="Enter refresh token or app password..."
                      value={formData.refreshToken || formData.smtpPass || ''}
                      onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value, smtpPass: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">SMTP Host (Optional)</label>
                    <input
                      type="text"
                      placeholder="smtp.gmail.com"
                      value={formData.smtpHost || ''}
                      onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {activeModalItem.providerId === 'GITHUB' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">GitHub Personal Access Token</label>
                  <input
                    type="password"
                    placeholder="ghp_..."
                    value={formData.token || ''}
                    onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500">Required for inspecting repositories, reading issues, and creating PRs.</p>
                </div>
              )}

              {activeModalItem.providerId === 'FILESYSTEM' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Workspace Root Path</label>
                  <input
                    type="text"
                    disabled
                    value={process.cwd ? process.cwd() : 'c:\\Users\\Sagar H C\\Downloads\\jarvis'}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400 font-mono"
                  />
                  <p className="text-[11px] text-emerald-400">Local workspace directory is mounted and authorized.</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                {activeModalItem.health.status === 'CONNECTED' ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium hover:bg-rose-500/10 rounded-lg transition"
                  >
                    Disconnect Provider
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={closeConfig}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-medium rounded-xl shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
                  >
                    {saving ? 'Testing & Saving...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
