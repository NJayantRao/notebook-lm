import { Router } from "express";

import { requireAuth } from "../middlewares/require-auth.js";
import AsyncHandler from "../utils/async-handler.js";
import controller from "../controllers/memories.controller.js";

const router: Router = Router();

router.use(requireAuth);
router.get("/", AsyncHandler(controller.listUserMemories));
router.post("/", AsyncHandler(controller.createUserMemory));
router.patch("/:memoryId", AsyncHandler(controller.updateMemory));
router.delete("/:memoryId", AsyncHandler(controller.deleteMemory));

export default router;
