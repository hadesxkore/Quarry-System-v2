// Offline queue for storing logs when network is unavailable
interface QueuedLog {
  id: string;
  data: any;
  timestamp: number;
}

const QUEUE_KEY = 'offline_log_queue';

export const offlineQueue = {
  // Add log to queue
  add(logData: any): string {
    const queue = this.getAll();
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    queue.push({
      id,
      data: logData,
      timestamp: Date.now(),
    });
    
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return id;
  },

  // Get all queued logs
  getAll(): QueuedLog[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  // Remove log from queue
  remove(id: string): void {
    const queue = this.getAll().filter(item => item.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  // Clear all queued logs
  clear(): void {
    localStorage.removeItem(QUEUE_KEY);
  },

  // Get count of queued logs
  count(): number {
    return this.getAll().length;
  }
};
