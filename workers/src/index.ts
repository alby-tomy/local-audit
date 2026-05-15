import "./processors/audit.processor.js";
import "./processors/delivery.processor.js";
import "./processors/fix.processor.js";
import "./processors/scraper.processor.js";

import { startEnqueueSubscriber } from "./services/enqueue-subscriber.js";

async function main() {
  await startEnqueueSubscriber();
  console.log("LocalAudit worker is running and subscribed to enqueue channels.");
}

main().catch((error) => {
  console.error("Worker bootstrap failed", error);
  process.exit(1);
});
