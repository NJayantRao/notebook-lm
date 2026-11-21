import { Router } from "express";

import AsyncHandler from "../utils/async-handler.js";
import {
  chatRateLimit,
  dailyMessageRateLimit,
} from "../middlewares/rate-limit.js";
import controller from "../controllers/conversations.controller.js";

const router: Router = Router({ mergeParams: true });

router.get("/", AsyncHandler(controller.listConversations));
router.post(
  "/",
  chatRateLimit,
  dailyMessageRateLimit,
  AsyncHandler(controller.createConversation)
);
router.post(
  "/stream",
  chatRateLimit,
  dailyMessageRateLimit,
  AsyncHandler(controller.createConversationStream)
);
router.get("/:conversationId", AsyncHandler(controller.getConversation));
router.post(
  "/:conversationId/messages",
  chatRateLimit,
  dailyMessageRateLimit,
  AsyncHandler(controller.sendConversationMessage)
);
router.post(
  "/:conversationId/messages/stream",
  chatRateLimit,
  dailyMessageRateLimit,
  AsyncHandler(controller.sendConversationMessageStream)
);

export default router;
