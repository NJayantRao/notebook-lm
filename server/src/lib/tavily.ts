import { tavily } from "@tavily/core";

import { ENV } from "../config/env.js";
import logger, { markLogged, timed } from "../config/logger.js";
import {
  BadGatewayError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import { logProviderTimeout, withTimeout } from "./timeout.js";

const PROVIDER = "tavily";
const TAVILY_TIMEOUT_MS = 30_000;

export const searchWeb = async (query: string) => {
  const apiKey = ENV.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "Web search is not configured.",
      "TAVILY_NOT_CONFIGURED"
    );
  }

  try {
    return await timed(
      "web_search",
      { provider: PROVIDER, queryChars: query.length, timeoutMs: TAVILY_TIMEOUT_MS },
      () =>
        withTimeout(
          tavily({ apiKey }).search(query, {
            searchDepth: "basic",
            maxResults: 5,
          }),
          TAVILY_TIMEOUT_MS,
          "Tavily web search"
        )
    );
  } catch (error) {
    if (!logProviderTimeout(PROVIDER, "web_search", TAVILY_TIMEOUT_MS, error)) {
      logger.error("web_search.failed", { provider: PROVIDER, error });
    }
    const apiError = new BadGatewayError(
      "Web search failed. Please try again.",
      "TAVILY_SEARCH_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};
