import { Router } from "express";

import AsyncHandler from "../utils/async-handler.js";
import { artifactRateLimit } from "../middlewares/rate-limit.js";
import controller from "../controllers/artifacts.controller.js";

// mergeParams keeps :workspaceId from the mount path available to controllers.
const router: Router = Router({ mergeParams: true });

router.post("/", artifactRateLimit, AsyncHandler(controller.createArtifact));
router.get("/", AsyncHandler(controller.listArtifacts));

router.get("/:artifactId/attempts", AsyncHandler(controller.listQuizAttempts));
router.post("/:artifactId/attempts", AsyncHandler(controller.submitQuizAttempt));

router.get("/:artifactId/flashcards", AsyncHandler(controller.listFlashcards));
router.get(
  "/:artifactId/flashcards/due",
  AsyncHandler(controller.getDueFlashcards)
);
router.post(
  "/:artifactId/flashcards/review",
  AsyncHandler(controller.reviewFlashcard)
);
router.get(
  "/:artifactId/flashcards/export",
  AsyncHandler(controller.exportFlashcards)
);

router.get(
  "/:artifactId/audio/download",
  AsyncHandler(controller.getPodcastAudioDownloadUrl)
);
router.post("/:artifactId/retry", AsyncHandler(controller.retryArtifact));
router.get("/:artifactId", AsyncHandler(controller.getArtifact));
router.delete("/:artifactId", AsyncHandler(controller.deleteArtifact));

export default router;
