export const env = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379/0",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  auditModel: process.env.CLAUDE_AUDIT_MODEL ?? "claude-haiku-4-5-20251001",
  fixModel: process.env.CLAUDE_FIX_MODEL ?? "claude-sonnet-4-20250514",
  r2AccountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? "",
  r2AccessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY ?? "",
  r2SecretKey: process.env.CLOUDFLARE_R2_SECRET_KEY ?? "",
  r2Bucket: process.env.CLOUDFLARE_R2_BUCKET ?? "localaudit-files",
  r2PublicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "",
  queueChannelPrefix: process.env.WORKER_REDIS_CHANNEL_PREFIX ?? "enqueue",
};
