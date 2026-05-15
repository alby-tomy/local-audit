import { Job, Worker } from "bullmq";

import { redisConnection } from "../services/redis.js";
import { supabase } from "../services/supabase.js";
import type { DeliveryJobPayload } from "../types.js";

export const deliveryWorker = new Worker<DeliveryJobPayload>(
  "delivery-queue",
  async (job: Job<DeliveryJobPayload>) => {
    const { auditId, tenantId, clientEmail } = job.data;

    await supabase.from("deliveries").insert({
      audit_id: auditId,
      tenant_id: tenantId,
      client_email: clientEmail,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return { auditId, clientEmail };
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);
