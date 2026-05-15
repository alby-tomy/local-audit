import { Job, Worker } from "bullmq";

import { redisConnection } from "../services/redis.js";
import { analyzeWebsite } from "../services/scraper.js";

type ScraperJobPayload = {
  websiteUrl: string;
};

export const scraperWorker = new Worker<ScraperJobPayload>(
  "scraper-queue",
  async (job: Job<ScraperJobPayload>) => {
    const result = await analyzeWebsite(job.data.websiteUrl);
    return {
      websiteUrl: job.data.websiteUrl,
      score: result.score,
      issuesFound: result.issues.length,
    };
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);
