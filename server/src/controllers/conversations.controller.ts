import type { Request, Response } from "express";

import ApiResponse from "../utils/api-response.js";
import validate from "../utils/validate.js";
import service from "../services/conversations.service.js";
import {
  conversationParamsSchema,
  createConversationSchema,
  sendConversationMessageSchema,
  workspaceConversationsParamsSchema,
} from "../validators/conversations.validator.js";

const listConversations = async (req: Request, res: Response) => {
  const { workspaceId } = validate(
    workspaceConversationsParamsSchema,
    req.params
  );
  const result = await service.listConversations(req.user.id, workspaceId);

  res.status(200).json(new ApiResponse(200, "Conversations retrieved", result));
};

const getConversation = async (req: Request, res: Response) => {
  const { workspaceId, conversationId } = validate(
    conversationParamsSchema,
    req.params
  );
  const result = await service.getConversation(
    req.user.id,
    workspaceId,
    conversationId
  );

  res.status(200).json(new ApiResponse(200, "Conversation retrieved", result));
};

const createConversation = async (req: Request, res: Response) => {
  const { workspaceId } = validate(
    workspaceConversationsParamsSchema,
    req.params
  );
  const input = validate(createConversationSchema, req.body);
  const result = await service.createConversation(
    req.user.id,
    workspaceId,
    input
  );

  res.status(201).json(new ApiResponse(201, "Conversation created", result));
};

const sendConversationMessage = async (req: Request, res: Response) => {
  const { workspaceId, conversationId } = validate(
    conversationParamsSchema,
    req.params
  );
  const input = validate(sendConversationMessageSchema, req.body);
  const result = await service.sendConversationMessage(
    req.user.id,
    workspaceId,
    conversationId,
    input
  );

  res.status(200).json(new ApiResponse(200, "Message sent", result));
};

export default {
  listConversations,
  getConversation,
  createConversation,
  sendConversationMessage,
};
