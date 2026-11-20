import app from "./app.js";
import { connectToDb } from "./config/db.js";
import { ENV } from "./config/env.js";

const PORT = ENV.PORT;

try {
  await connectToDb();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
  });
} catch (error) {
  console.error("Server startup aborted:", error);
  process.exit(1);
}
