import { Firecrawl } from "firecrawl";
import { ENV } from "../config/env.js";
import logger, { markLogged, timed } from "../config/logger.js";
import {
  BadGatewayError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import { logProviderTimeout } from "./timeout.js";

const PROVIDER = "firecrawl";
const FIRECRAWL_TIMEOUT_MS = 30_000;

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
};

export type ScrapedWebsite = {
  url: string;
  title?: string;
  markdown: string;
  metadata: Record<string, unknown>;
};

export const scrapeWebsiteByUrl = async (
  url: string
): Promise<ScrapedWebsite> => {
  const apiKey = ENV.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "Website scraping is not configured.",
      "FIRECRAWL_NOT_CONFIGURED"
    );
  }

  const firecrawl = new Firecrawl({ apiKey, timeoutMs: FIRECRAWL_TIMEOUT_MS });
  const host = hostnameOf(url);
  let result;

  try {
    result = await timed(
      "website.scrape",
      { provider: PROVIDER, host, timeoutMs: FIRECRAWL_TIMEOUT_MS },
      () =>
        firecrawl.scrape(url, {
          formats: ["markdown"],
          onlyMainContent: true,
        })
    );
  } catch (error) {
    if (!logProviderTimeout(PROVIDER, "website.scrape", FIRECRAWL_TIMEOUT_MS, error)) {
      logger.error("website.scrape.failed", { provider: PROVIDER, host, error });
    }
    const apiError = new BadGatewayError(
      "The website could not be scraped. Check the URL and try again.",
      "WEBSITE_SCRAPE_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }

  if (result.metadata?.error) {
    logger.warn("website.scrape.degraded", {
      provider: PROVIDER,
      host,
      reason: "provider_error",
    });
    const apiError = new BadGatewayError(
      "The website could not be scraped. Check the URL and try again.",
      "WEBSITE_SCRAPE_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }

  const markdown = result.markdown?.trim();
  if (!markdown) {
    throw new BadGatewayError(
      "The website did not provide any readable content.",
      "WEBSITE_CONTENT_EMPTY"
    );
  }

  return {
    url: result.metadata?.url || result.metadata?.sourceURL || url,
    ...(result.metadata?.title?.trim()
      ? { title: result.metadata.title.trim() }
      : {}),
    markdown,
    metadata: result.metadata ?? {},
  };
};
