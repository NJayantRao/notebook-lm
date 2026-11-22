import app from "./app.js";
import { connectToDb } from "./config/db.js";
import { connectToInngest } from "./config/inngest.js";
import { ENV } from "./config/env.js";

const PORT = ENV.PORT || 5000;

try {
  await connectToDb();
  await connectToInngest();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
  });
} catch (error) {
  console.error("Server startup aborted:", error);
  process.exit(1);
}
