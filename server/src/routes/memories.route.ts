import { Router } from "express";

import AsyncHandler from "../utils/async-handler.js";
import controller from "../controllers/memories.controller.js";

const router: Router = Router();

router.get("/", AsyncHandler(controller.listUserMemories));
router.post("/", AsyncHandler(controller.createUserMemory));
router.patch("/:memoryId", AsyncHandler(controller.updateMemory));
router.delete("/:memoryId", AsyncHandler(controller.deleteMemory));

export default router;
