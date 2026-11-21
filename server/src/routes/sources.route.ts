import { Router } from "express";

import AsyncHandler from "../utils/async-handler.js";
import { sourceRateLimit } from "../middlewares/rate-limit.js";
import { uploadPdfFile } from "../lib/multer.js";

import controller from "../controllers/sources.controller.js";

// mergeParams keeps :workspaceId from the mount path available to controllers.
const router: Router = Router({ mergeParams: true });

router.get("/", AsyncHandler(controller.listAllSources));
router.post("/", sourceRateLimit, AsyncHandler(controller.createSources));
router.post(
  "/import/website",
  sourceRateLimit,
  AsyncHandler(controller.importWebsite)
);
router.post(
  "/import/youtube",
  sourceRateLimit,
  AsyncHandler(controller.importYouTube)
);
router.post(
  "/upload",
  controller.validateUploadWorkspace,
  sourceRateLimit,
  uploadPdfFile,
  AsyncHandler(controller.uploadPdf)
);
router.delete("/bulk-delete", AsyncHandler(controller.bulkDeleteSources));
router.delete("/:sourceId", AsyncHandler(controller.deleteSource));

export default router;
