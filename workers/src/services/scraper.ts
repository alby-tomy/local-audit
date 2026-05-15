import axios from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

import type { AuditIssue } from "../types.js";

const issueConfig: Record<string, { name: string; description: string; score_penalty: number }> = {
  no_https: {
    name: "No HTTPS / SSL",
    description: "Website uses insecure HTTP and may trigger browser warnings.",
    score_penalty: 20,
  },
  site_unreachable: {
    name: "Website unreachable",
    description: "Website could not be loaded for analysis.",
    score_penalty: 30,
  },
  slow_load: {
    name: "Slow load time (>4s)",
    description: "Page is loading slowly and may reduce conversions.",
    score_penalty: 12,
  },
  missing_viewport: {
    name: "Not mobile-friendly",
    description: "Missing viewport tag for responsive rendering.",
    score_penalty: 15,
  },
  missing_meta_title: {
    name: "Missing title tag",
    description: "Missing or empty title tag.",
    score_penalty: 8,
  },
  missing_meta_description: {
    name: "Missing meta description",
    description: "No meta description provided.",
    score_penalty: 6,
  },
  no_whatsapp_button: {
    name: "No WhatsApp button",
    description: "WhatsApp contact path not found.",
    score_penalty: 10,
  },
  no_google_maps_embed: {
    name: "No Google Maps",
    description: "No Google Maps embed/link detected.",
    score_penalty: 8,
  },
  no_social_links: {
    name: "No social links",
    description: "No major social profile links found.",
    score_penalty: 5,
  },
  no_contact_form: {
    name: "No contact form",
    description: "No lead capture form identified.",
    score_penalty: 7,
  },
  missing_phone: {
    name: "No visible phone number",
    description: "Phone pattern not found in page HTML.",
    score_penalty: 6,
  },
  outdated_copyright: {
    name: "Outdated copyright",
    description: "Footer copyright year appears outdated.",
    score_penalty: 4,
  },
  missing_og_tags: {
    name: "No social sharing meta tags",
    description: "Open Graph metadata not found.",
    score_penalty: 4,
  },
  missing_schema: {
    name: "No LocalBusiness schema",
    description: "Schema markup for local business not found.",
    score_penalty: 5,
  },
};

export async function analyzeWebsite(url: string): Promise<{
  reachable: boolean;
  issues: AuditIssue[];
  score: number;
  loadTimeMs: number;
  html: string;
}> {
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const issues: string[] = [];
  if (!normalizedUrl.startsWith("https://")) {
    issues.push("no_https");
  }

  let html = "";
  let loadTimeMs = 0;

  try {
    const started = Date.now();
    const response = await axios.get<string>(normalizedUrl, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "LocalAuditBot/1.0 (+https://localauditai.com)",
      },
    });
    loadTimeMs = Date.now() - started;
    html = response.data;
  } catch {
    issues.push("site_unreachable");
    return {
      reachable: false,
      issues: issues.map((id) => ({ id, ...issueConfig[id] })),
      score: 0,
      loadTimeMs: 0,
      html: "",
    };
  }

  if (loadTimeMs > 4000) {
    issues.push("slow_load");
  }

  const $ = cheerio.load(html);

  if ($('meta[name="viewport"]').length === 0) {
    issues.push("missing_viewport");
  }

  const title = $("title").first().text().trim();
  if (!title) {
    issues.push("missing_meta_title");
  }

  const metaDescription = $('meta[name="description"]').attr("content")?.trim();
  if (!metaDescription) {
    issues.push("missing_meta_description");
  }

  const htmlLower = html.toLowerCase();
  if (!htmlLower.includes("wa.me") && !htmlLower.includes("whatsapp")) {
    issues.push("no_whatsapp_button");
  }

  if (
    !htmlLower.includes("maps.google") &&
    !htmlLower.includes("goo.gl/maps") &&
    !htmlLower.includes("maps.app.goo.gl")
  ) {
    issues.push("no_google_maps_embed");
  }

  const socialPatterns = ["facebook.com", "instagram.com", "twitter.com", "linkedin.com", "youtube.com"];
  if (!socialPatterns.some((pattern) => htmlLower.includes(pattern))) {
    issues.push("no_social_links");
  }

  if ($("form").length === 0) {
    issues.push("no_contact_form");
  }

  const phonePattern = /[\+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}/;
  if (!phonePattern.test(html)) {
    issues.push("missing_phone");
  }

  const copyrightPattern = /©\s*(\d{4})/;
  const copyrightMatch = html.match(copyrightPattern);
  const currentYear = new Date().getFullYear();
  if (copyrightMatch && Number(copyrightMatch[1]) < currentYear - 1) {
    issues.push("outdated_copyright");
  }

  if ($('meta[property="og:title"]').length === 0) {
    issues.push("missing_og_tags");
  }

  if (!htmlLower.includes("localbusiness") && !htmlLower.includes("application/ld+json")) {
    issues.push("missing_schema");
  }

  const scorePenalty = issues.reduce((sum, key) => sum + (issueConfig[key]?.score_penalty ?? 0), 0);
  const score = Math.max(0, 100 - scorePenalty);

  return {
    reachable: true,
    issues: issues.map((id) => ({ id, ...issueConfig[id] })),
    score,
    loadTimeMs,
    html,
  };
}

export async function takeScreenshot(url: string): Promise<Buffer> {
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 LocalAuditBot/1.0",
  });
  const page = await context.newPage();
  await page.goto(normalized, { waitUntil: "networkidle", timeout: 20000 });
  const screenshot = await page.screenshot({ fullPage: true, type: "png" });
  await browser.close();
  return screenshot;
}
