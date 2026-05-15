import { Queue } from "bullmq";

import { redisConnection } from "../services/redis.js";
import type { AuditJobPayload } from "../types.js";

export const auditQueueName = "audit-queue";

export const auditQueue = new Queue<AuditJobPayload>(auditQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
