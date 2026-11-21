import { Router } from "express";

import AsyncHandler from "../utils/async-handler.js";
import { chatRateLimit } from "../middlewares/rate-limit.js";
import controller from "../controllers/conversations.controller.js";

const router: Router = Router({ mergeParams: true });

router.get("/", AsyncHandler(controller.listConversations));
router.post(
  "/",
  chatRateLimit,
  AsyncHandler(controller.createConversation)
);
router.get("/:conversationId", AsyncHandler(controller.getConversation));
router.post(
  "/:conversationId/messages",
  chatRateLimit,
  AsyncHandler(controller.sendConversationMessage)
);

export default router;
