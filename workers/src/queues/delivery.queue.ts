import { Queue } from "bullmq";

import { redisConnection } from "../services/redis.js";
import type { DeliveryJobPayload } from "../types.js";

export const deliveryQueueName = "delivery-queue";

export const deliveryQueue = new Queue<DeliveryJobPayload>(deliveryQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
