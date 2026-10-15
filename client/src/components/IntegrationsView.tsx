import React from 'react';
import { IntegrationItem } from '../services/api';
import { CheckCircle2, AlertCircle, XCircle, Settings2, ShieldCheck, ExternalLink, Sparkles } from 'lucide-react';

interface IntegrationsViewProps {
  integrations: IntegrationItem[];
  onRefresh: () => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ integrations, onRefresh }) => {
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
                <span className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center space-x-1">
                  <span>Configure</span>
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
