import IORedis from "ioredis";

import { env } from "../config.js";

export const redisConnection = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
});
