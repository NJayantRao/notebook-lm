import { Router } from "express";

import { requireAuth } from "../middlewares/require-auth.js";
import AsyncHandler from "../utils/async-handler.js";
import { uploadPdfFile } from "../lib/multer.js";

import controller from "../controllers/sources.controller.js";

// mergeParams keeps :workspaceId from the mount path available to controllers.
const router: Router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", AsyncHandler(controller.listAllSources));
router.post("/", AsyncHandler(controller.createSources));
router.post(
  "/upload",
  controller.validateUploadWorkspace,
  uploadPdfFile,
  AsyncHandler(controller.uploadPdf)
);
router.delete("/bulk-delete", AsyncHandler(controller.bulkDeleteSources));
router.delete("/:sourceId", AsyncHandler(controller.deleteSource));

export default router;
