import { Router } from "express";

import AsyncHandler from "../utils/async-handler.js";
import { memoryRateLimit } from "../middlewares/rate-limit.js";
import controller from "../controllers/memories.controller.js";

const router: Router = Router();

router.get("/", AsyncHandler(controller.listUserMemories));
router.post("/", memoryRateLimit, AsyncHandler(controller.createUserMemory));
router.patch(
  "/:memoryId",
  memoryRateLimit,
  AsyncHandler(controller.updateMemory)
);
router.delete(
  "/:memoryId",
  memoryRateLimit,
  AsyncHandler(controller.deleteMemory)
);

export default router;
