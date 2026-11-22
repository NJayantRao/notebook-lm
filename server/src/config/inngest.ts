import { inngest } from "../lib/inngest.js";

async function ensureInngestReady(): Promise<void> {
  await inngest.ready;
}

async function connectToInngest(): Promise<void> {
  try {
    await ensureInngestReady();
    // This event intentionally has no handler; sending it verifies event API connectivity.
    await inngest.send({
      name: "system/connection.check",
      data: { service: "notebook-lm", checkedAt: new Date().toISOString() },
    });
    console.log("✅✅ Inngest connection verified successfully");
  } catch (error) {
    console.error("Failed to connect to Inngest:", error);
    throw error;
  }
}

async function checkInngestReadiness(): Promise<void> {
  try {
    await ensureInngestReady();
  } catch (error) {
    console.error("Inngest client readiness check failed:", error);
    throw error;
  }
}

export { connectToInngest, checkInngestReadiness };
