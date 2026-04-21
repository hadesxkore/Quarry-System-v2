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
    try {
      const queue = this.getAll();
      const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      queue.push({
        id,
        data: logData,
        timestamp: Date.now(),
      });
      
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log('✅ Log added to offline queue:', id);
      return id;
    } catch (error) {
      console.error('❌ Failed to add to offline queue:', error);
      throw error;
    }
  },

  // Get all queued logs
  getAll(): QueuedLog[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to read offline queue:', error);
      return [];
    }
  },

  // Remove log from queue
  remove(id: string): void {
    try {
      const queue = this.getAll().filter(item => item.id !== id);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log('✅ Log removed from offline queue:', id);
    } catch (error) {
      console.error('❌ Failed to remove from offline queue:', error);
    }
  },

  // Clear all queued logs
  clear(): void {
    try {
      localStorage.removeItem(QUEUE_KEY);
      console.log('✅ Offline queue cleared');
    } catch (error) {
      console.error('❌ Failed to clear offline queue:', error);
    }
  },

  // Get count of queued logs
  count(): number {
    return this.getAll().length;
  }
};
