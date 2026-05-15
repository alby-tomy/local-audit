import { Job, Worker } from "bullmq";

import { fixQueue } from "../queues/fix.queue.js";
import { generateAuditReport } from "../services/ai.js";
import { redisConnection } from "../services/redis.js";
import { analyzeWebsite, takeScreenshot } from "../services/scraper.js";
import { uploadToR2 } from "../services/storage.js";
import { supabase } from "../services/supabase.js";
import type { AuditJobPayload } from "../types.js";

export const auditWorker = new Worker<AuditJobPayload>(
  "audit-queue",
  async (job: Job<AuditJobPayload>) => {
    const { auditId, tenantId, websiteUrl } = job.data;

    try {
      await supabase.from("audits").update({ status: "running", started_at: new Date().toISOString() }).eq("id", auditId);

      await job.updateProgress(20);
      const analysis = await analyzeWebsite(websiteUrl);

      await job.updateProgress(40);
      const screenshot = await takeScreenshot(websiteUrl);
      const screenshotUrl = await uploadToR2(`audits/${auditId}/before.png`, screenshot, "image/png");

      await job.updateProgress(70);
      const { data: auditRecord } = await supabase
        .from("audits")
        .select("business_name, city")
        .eq("id", auditId)
        .single();

      const report = await generateAuditReport(
        (auditRecord?.business_name as string | null | undefined) ?? null,
        websiteUrl,
        (auditRecord?.city as string | null | undefined) ?? null,
        analysis.issues,
      );

      await job.updateProgress(90);
      await supabase
        .from("audits")
        .update({
          status: "completed",
          issues: analysis.issues,
          score: analysis.score,
          load_time_ms: analysis.loadTimeMs,
          screenshot_before: screenshotUrl,
          error: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", auditId);

      if (analysis.issues.length > 0) {
        await fixQueue.addBulk(
          analysis.issues
            .filter((issue) => issue.id !== "no_https" && issue.id !== "site_unreachable")
            .map((issue) => ({
              name: "fix-issue",
              data: { auditId, tenantId, issue, html: analysis.html },
              opts: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
            })),
        );
      }

      await supabase.from("usage_logs").insert({
        tenant_id: tenantId,
        action: "audit_completed",
        credits_consumed: 1,
        metadata: { auditId, issueCount: analysis.issues.length, score: analysis.score, report },
      });

      await job.updateProgress(100);
      return { auditId, score: analysis.score, issues: analysis.issues.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown audit error";
      await supabase.from("audits").update({ status: "failed", error: message }).eq("id", auditId);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  },
);
