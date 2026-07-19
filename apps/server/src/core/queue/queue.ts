export interface QueueJob {
  name: string;
  payload: unknown;
}

export interface Queue {
  enqueue(job: QueueJob): Promise<void>;
}
