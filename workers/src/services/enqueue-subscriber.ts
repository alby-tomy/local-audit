import IORedis from "ioredis";

import { env } from "../config.js";
import { auditQueue } from "../queues/audit.queue.js";
import { deliveryQueue } from "../queues/delivery.queue.js";
import { fixQueue } from "../queues/fix.queue.js";
import type { AuditJobPayload, DeliveryJobPayload, FixJobPayload } from "../types.js";

function channel(name: string) {
  return `${env.queueChannelPrefix}:${name}`;
}

export async function startEnqueueSubscriber(): Promise<IORedis> {
  const subscriber = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

  await subscriber.subscribe(channel("audit"), channel("fix"), channel("delivery"));

  subscriber.on("message", async (ch, message) => {
    try {
      if (ch === channel("audit")) {
        const payload = JSON.parse(message) as AuditJobPayload;
        await auditQueue.add("run-audit", payload);
      }

      if (ch === channel("fix")) {
        const payload = JSON.parse(message) as FixJobPayload;
        await fixQueue.add("fix-issue", payload);
      }

      if (ch === channel("delivery")) {
        const payload = JSON.parse(message) as DeliveryJobPayload;
        await deliveryQueue.add("deliver-package", payload);
      }
    } catch (error) {
      console.error("Failed to parse or enqueue message", { channel: ch, error });
    }
  });

  return subscriber;
}
