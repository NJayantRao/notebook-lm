import { tavily } from "@tavily/core";

import { ENV } from "../config/env.js";
import {
  BadGatewayError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import { withTimeout } from "./timeout.js";

export const searchWeb = async (query: string) => {
  const apiKey = ENV.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "Web search is not configured.",
      "TAVILY_NOT_CONFIGURED"
    );
  }

  try {
    return await withTimeout(
      tavily({ apiKey }).search(query, {
        searchDepth: "basic",
        maxResults: 5,
      }),
      30_000,
      "Tavily web search"
    );
  } catch (error) {
    console.error("Tavily web search failed:", error);
    throw new BadGatewayError(
      "Web search failed. Please try again.",
      "TAVILY_SEARCH_FAILED"
    );
  }
};
