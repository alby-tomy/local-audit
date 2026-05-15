import { Job, Worker } from "bullmq";

import { redisConnection } from "../services/redis.js";
import { analyzeWebsite } from "../services/scraper.js";
import { supabase } from "../services/supabase.js";
import { generateFixPatch } from "../services/ai.js";
import type { FixJobPayload } from "../types.js";

export const fixWorker = new Worker<FixJobPayload>(
  "fix-queue",
  async (job: Job<FixJobPayload>) => {
    const { auditId, tenantId, issue, html } = job.data;

    try {
      await job.updateProgress(20);

      let sourceHtml = html;
      if (!sourceHtml) {
        const { data: auditRow } = await supabase
          .from("audits")
          .select("website_url")
          .eq("id", auditId)
          .single();

        if (!auditRow?.website_url) {
          throw new Error("Audit website_url missing for fix generation");
        }

        const analysis = await analyzeWebsite(String(auditRow.website_url));
        sourceHtml = analysis.html;
      }

      if (!sourceHtml) {
        throw new Error("Could not determine HTML source for fix");
      }

      await job.updateProgress(60);
      const patch = await generateFixPatch(sourceHtml, issue.id, issue.description ?? "");

      await job.updateProgress(90);
      await supabase.from("fixes").insert({
        audit_id: auditId,
        tenant_id: tenantId,
        issue_type: issue.id,
        issue_description: issue.description ?? null,
        patch_html: patch.patch_code,
        patch_instructions: patch.instructions,
        status: "generated",
        ai_model: process.env.CLAUDE_FIX_MODEL ?? "claude-sonnet-4-20250514",
        generated_at: new Date().toISOString(),
      });

      await supabase.from("usage_logs").insert({
        tenant_id: tenantId,
        action: "fix_generated",
        credits_consumed: 0,
        metadata: { auditId, issueId: issue.id, estimatedImpact: patch.estimated_impact },
      });

      await job.updateProgress(100);
      return { auditId, issueId: issue.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fix error";
      await supabase.from("fixes").insert({
        audit_id: auditId,
        tenant_id: tenantId,
        issue_type: issue.id,
        issue_description: issue.description ?? null,
        status: "failed",
        error: message,
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);
