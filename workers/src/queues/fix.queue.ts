import { Queue } from "bullmq";

import { redisConnection } from "../services/redis.js";
import type { FixJobPayload } from "../types.js";

export const fixQueueName = "fix-queue";

export const fixQueue = new Queue<FixJobPayload>(fixQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
