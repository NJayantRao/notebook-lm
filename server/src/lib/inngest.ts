import { Inngest, wrapStringFirstLogger, type Logger as InngestLogger } from "inngest";

import { ENV } from "../config/env.js";
import logger from "../config/logger.js";

// Inngest logs Pino-style (object first); wrapStringFirstLogger keeps Winston's
// (message, meta) signature intact. The child method preserves run-scoped fields.
const inngestLogger = {
  ...wrapStringFirstLogger(logger),
  child: (metadata: object) => wrapStringFirstLogger(logger.child(metadata)),
} as unknown as InngestLogger;

export const inngest = new Inngest({
  id: "notebook-lm",
  logger: inngestLogger,
  ...(ENV.INNGEST_DEV === undefined ? {} : { isDev: ENV.INNGEST_DEV }),
});
