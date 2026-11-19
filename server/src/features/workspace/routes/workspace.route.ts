import { Router } from "express";

import { requireAuth } from "../../../middlewares/require-auth.js";
import AsyncHandler from "../../../utils/async-handler.js";

import controller from "../controllers/workspace.controller.js";

const router: Router = Router();

router.use(requireAuth);

router.get("/", AsyncHandler(controller.listWorkspaces));
router.post("/", AsyncHandler(controller.createWorkspace));
router.get("/:workspaceId", AsyncHandler(controller.getWorkspaceById));
router.patch("/:workspaceId", AsyncHandler(controller.updateWorkspace));
router.delete("/:workspaceId", AsyncHandler(controller.deleteWorkspace));

export default router;
