import { inngest } from "../lib/inngest.js";
import { timed } from "./logger.js";

async function ensureInngestReady(): Promise<void> {
  await inngest.ready;
}

async function connectToInngest(): Promise<void> {
  await timed("inngest.connect", {}, async () => {
    await ensureInngestReady();
    // This event intentionally has no handler; sending it verifies event API connectivity.
    await inngest.send({
      name: "system/connection.check",
      data: { service: "notebook-lm", checkedAt: new Date().toISOString() },
    });
  });
}

async function checkInngestReadiness(): Promise<void> {
  await timed("inngest.health", {}, () => ensureInngestReady());
}

export { connectToInngest, checkInngestReadiness };
