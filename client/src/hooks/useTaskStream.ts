import { useEffect, useState } from 'react';

export interface StreamEvent {
  type: string;
  taskId?: string;
  payload: any;
  timestamp: string;
}

export function useTaskStream(onEvent?: (event: StreamEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimer: any = null;

    function connect() {
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const parsed: StreamEvent = JSON.parse(e.data);
          setLastEvent(parsed);
          if (onEvent) onEvent(parsed);
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };

      eventSource.onerror = () => {
        setConnected(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventSource) eventSource.close();
    };
  }, []);

  return { connected, lastEvent };
}
