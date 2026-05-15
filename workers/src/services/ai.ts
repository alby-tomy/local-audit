import Anthropic from "@anthropic-ai/sdk";

import { env } from "../config.js";
import type { AuditIssue } from "../types.js";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

function readText(message: Anthropic.Message): string {
  return message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

export async function generateAuditReport(
  businessName: string | null,
  website: string,
  city: string | null,
  issues: AuditIssue[],
): Promise<string> {
  const issueList = issues.map((issue) => `- ${issue.name ?? issue.id}: ${issue.description ?? ""}`).join("\n");

  const response = await client.messages.create({
    model: env.auditModel,
    max_tokens: 500,
    system:
      "You are a web consultant. Write a short personalized audit summary under 200 words in plain text with a clear CTA.",
    messages: [
      {
        role: "user",
        content: `Business: ${businessName ?? "Local business"}\nCity: ${city ?? "Unknown"}\nWebsite: ${website}\nIssues:\n${issueList}`,
      },
    ],
  });

  return readText(response);
}

export async function generateFixPatch(
  html: string,
  issueType: string,
  issueDescription: string,
): Promise<{ patch_type: string; patch_code: string; instructions: string; estimated_impact: string }> {
  const response = await client.messages.create({
    model: env.fixModel,
    max_tokens: 1500,
    system:
      "Generate a minimal HTML/CSS patch for one issue. Return JSON with patch_type, patch_code, instructions, estimated_impact.",
    messages: [
      {
        role: "user",
        content: `Issue: ${issueType}\nDescription: ${issueDescription}\nHTML:\n${html.slice(0, 8000)}`,
      },
    ],
  });

  const text = readText(response).replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
