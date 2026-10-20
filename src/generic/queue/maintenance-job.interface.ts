import type { RepeatOptions } from 'bullmq';

export interface MaintenanceJobInterface {
  name: string;
  repeat: Omit<RepeatOptions, 'key'>;
  handle: () => Promise<void>;
}
