import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TaskCreator } from './components/TaskCreator';
import { TaskList } from './components/TaskList';
import { TaskDetailView } from './components/TaskDetailView';
import { CalendarView } from './components/CalendarView';
import { ApprovalsCenter } from './components/ApprovalsCenter';
import { IntegrationsView } from './components/IntegrationsView';
import { DevicesView } from './components/DevicesView';
import { MemoryCenter } from './components/MemoryCenter';
import { SchedulesView } from './components/SchedulesView';
import { AuditLogsView } from './components/AuditLogsView';
import { useTaskStream } from './hooks/useTaskStream';
import {
  api,
  TaskSummary,
  ApprovalItem,
  IntegrationItem,
  DeviceItem,
  MemoryItem,
  ScheduleItem,
  AuditItem
} from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [modelUsage, setModelUsage] = useState<any>({});
  const [submittingTask, setSubmittingTask] = useState(false);

  // Load all data
  const loadData = async () => {
    try {
      const [tList, appList, intList, devList, memList, schList, aud] = await Promise.all([
        api.getTasks().catch(() => []),
        api.getApprovals().catch(() => []),
        api.getIntegrations().catch(() => []),
        api.getDevices().catch(() => []),
        api.getMemories().catch(() => []),
        api.getSchedules().catch(() => []),
        api.getAudit().catch(() => ({ logs: [], usage: {} }))
      ]);

      setTasks(tList);
      setApprovals(appList);
      setIntegrations(intList);
      setDevices(devList);
      setMemories(memList);
      setSchedules(schList);
      setAuditLogs(aud.logs || []);
      setModelUsage(aud.usage || {});

      // Auto-select first task if none selected
      if (!selectedTaskId && tList.length > 0) {
        setSelectedTaskId(tList[0].id);
      }
    } catch (err) {
      console.error('Error fetching initial dashboard data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const pollInterval = setInterval(loadData, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // Real-time SSE updates
  const { connected } = useTaskStream((event) => {
    if (event.type.startsWith('TASK_') || event.type.startsWith('STEP_')) {
      loadData();
    }
  });

  const handleCreateTask = async (request: string) => {
    setSubmittingTask(true);
    try {
      const res = await api.submitTask(request);
      if (res.taskId) {
        setSelectedTaskId(res.taskId);
        setActiveTab('tasks');
        await loadData();
      }
    } catch (err) {
      console.error('Failed to submit task:', err);
    } finally {
      setSubmittingTask(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sseConnected={connected}
        pendingApprovalsCount={approvals.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <TaskCreator onSubmitTask={handleCreateTask} loading={submittingTask} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Task Sidebar List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Activity History ({tasks.length})
                  </h3>
                  <button
                    onClick={loadData}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Refresh
                  </button>
                </div>
                <TaskList
                  tasks={tasks}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={(id) => setSelectedTaskId(id)}
                />
              </div>

              {/* Task Execution Detail & Step Graph */}
              <div className="lg:col-span-7">
                {selectedTaskId ? (
                  <TaskDetailView
                    taskId={selectedTaskId}
                    onRefresh={loadData}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                  />
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
                    Select a task from the list or issue a goal above to view execution details.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calendar & Meetings Tab */}
        {activeTab === 'calendar' && (
          <CalendarView />
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <ApprovalsCenter approvals={approvals} onRefresh={loadData} />
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <IntegrationsView integrations={integrations} onRefresh={loadData} />
        )}

        {/* Devices Tab */}
        {activeTab === 'devices' && (
          <DevicesView devices={devices} onRefresh={loadData} />
        )}

        {/* Memory Tab */}
        {activeTab === 'memory' && (
          <MemoryCenter memories={memories} onRefresh={loadData} />
        )}

        {/* Schedules Tab */}
        {activeTab === 'schedules' && (
          <SchedulesView schedules={schedules} onRefresh={loadData} />
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <AuditLogsView logs={auditLogs} usage={modelUsage} onRefresh={loadData} />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-600 font-mono">
        JARVIS v1.0 Autonomous AI Operating Agent • Fully Verified Deterministic Engine
      </footer>
    </div>
  );
};

export default App;
