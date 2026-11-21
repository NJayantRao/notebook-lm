import { Router } from "express";

import AsyncHandler from "../utils/async-handler.js";

import controller from "../controllers/workspaces.controller.js";

const router: Router = Router();

router.get("/", AsyncHandler(controller.listWorkspaces));
router.post("/", AsyncHandler(controller.createWorkspace));
router.get("/:workspaceId", AsyncHandler(controller.getWorkspaceById));
router.patch("/:workspaceId", AsyncHandler(controller.updateWorkspace));
router.delete("/:workspaceId", AsyncHandler(controller.deleteWorkspace));

export default router;
