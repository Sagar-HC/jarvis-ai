import React from 'react';
import { Cpu, Radio, ShieldCheck, CheckCircle2, Clock, Terminal, HardDrive, Brain, Calendar, Bell } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sseConnected: boolean;
  pendingApprovalsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  sseConnected,
  pendingApprovalsCount
}) => {
  const tabs = [
    { id: 'tasks', label: 'Tasks', icon: Terminal },
    { id: 'approvals', label: 'Approvals', icon: ShieldCheck, badge: pendingApprovalsCount },
    { id: 'integrations', label: 'Integrations', icon: CheckCircle2 },
    { id: 'devices', label: 'Devices', icon: HardDrive },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'audit', label: 'Audit & Metrics', icon: Clock }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Cpu className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                  JARVIS
                </span>
                <span className="text-[10px] font-mono uppercase bg-blue-950 text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded">
                  v1.0 Autonomous
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Master Personal AI Operating Agent</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex space-x-1 overflow-x-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 text-xs font-bold rounded-full animate-bounce">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Status Pill */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-full text-xs">
              <span className={`h-2 w-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
              <span className="text-slate-300 font-mono text-[11px]">{sseConnected ? 'STREAM ACTIVE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
