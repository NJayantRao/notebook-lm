import { Inngest } from "inngest";
import { ENV } from "../config/env.js";

export const inngest = new Inngest({
  id: "notebook-lm",
  ...(ENV.INNGEST_DEV === undefined ? {} : { isDev: ENV.INNGEST_DEV }),
});
