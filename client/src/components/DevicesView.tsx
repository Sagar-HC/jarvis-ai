import React from 'react';
import { DeviceItem } from '../services/api';
import { HardDrive, Laptop, Smartphone, Server, Radio, ShieldCheck, Clock } from 'lucide-react';

interface DevicesViewProps {
  devices: DeviceItem[];
  onRefresh: () => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({ devices, onRefresh }) => {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'DESKTOP':
        return Laptop;
      case 'MOBILE':
        return Smartphone;
      case 'SERVER':
        return Server;
      default:
        return HardDrive;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Enrolled Devices & Execution Routing</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Distributed execution leases, device presence heartbeats, and local companion workers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Central Server Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Central Cloud Server</h4>
                <span className="text-[11px] text-slate-500 font-mono">server-local</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              ONLINE
            </span>
          </div>

          <div className="text-xs text-slate-400 space-y-1">
            <p>Routes cloud-compatible steps, memory, scheduling, and orchestrator pipelines.</p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Primary Coordinator</span>
            <span className="text-emerald-400 font-mono text-[11px]">Authorized</span>
          </div>
        </div>

        {/* Dynamic Registered Devices */}
        {devices.map((device) => {
          const Icon = getDeviceIcon(device.deviceType);
          const isOnline = device.connectionStatus === 'ONLINE';

          return (
            <div
              key={device.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">{device.deviceName}</h4>
                    <span className="text-[11px] text-slate-500 font-mono truncate block max-w-[150px]">
                      {device.deviceId}
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}>
                  {device.connectionStatus}
                </span>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <span className="text-[11px] font-mono text-slate-500 uppercase block">Capabilities:</span>
                <span className="font-mono text-slate-300 text-[11px] block truncate">
                  {device.capabilities}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Heartbeat: {new Date(device.lastHeartbeat).toLocaleTimeString()}</span>
                <span className="text-blue-400 font-mono text-[11px]">Lease Ready</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 text-xs text-slate-400 space-y-2">
        <h5 className="font-semibold text-slate-300">Run the Desktop Companion Worker</h5>
        <p>To authorize local shell commands and native computer actions on your laptop or workstation, run:</p>
        <pre className="bg-slate-900 border border-slate-800 p-3 rounded-xl font-mono text-cyan-300 text-xs">
          npm run dev:worker
        </pre>
      </div>
    </div>
  );
};
