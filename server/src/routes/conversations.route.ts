import { Router } from "express";

import { requireAuth } from "../middlewares/require-auth.js";
import AsyncHandler from "../utils/async-handler.js";
import controller from "../controllers/conversations.controller.js";

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);
router.get("/", AsyncHandler(controller.listConversations));
router.post("/", AsyncHandler(controller.createConversation));
router.get("/:conversationId", AsyncHandler(controller.getConversation));
router.post(
  "/:conversationId/messages",
  AsyncHandler(controller.sendConversationMessage)
);

export default router;
