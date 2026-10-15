import { Response } from 'express';

export interface JarvisEvent {
  type: string;
  userId?: string;
  taskId?: string;
  payload: any;
  timestamp: string;
}

export class EventBroadcaster {
  private static instance: EventBroadcaster;
  private clients: Map<string, { res: Response; userId?: string }> = new Map();

  private constructor() {}

  public static getInstance(): EventBroadcaster {
    if (!EventBroadcaster.instance) {
      EventBroadcaster.instance = new EventBroadcaster();
    }
    return EventBroadcaster.instance;
  }

  public addClient(clientId: string, res: Response, userId?: string): void {
    this.clients.set(clientId, { res, userId });

    // Send initial connected ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  public broadcast(event: Omit<JarvisEvent, 'timestamp'>): void {
    const fullEvent: JarvisEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    const data = `data: ${JSON.stringify(fullEvent)}\n\n`;

    for (const [_, client] of this.clients.entries()) {
      // If event is scoped to a specific user, only send to that user
      if (fullEvent.userId && client.userId && client.userId !== fullEvent.userId) {
        continue;
      }
      try {
        client.res.write(data);
      } catch (err) {
        console.error('Failed to write SSE event to client:', err);
      }
    }
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }
}
