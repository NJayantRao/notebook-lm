import { Firecrawl } from "firecrawl";
import { ENV } from "../config/env.js";
import { BadGatewayError, ServiceUnavailableError } from "../utils/api-error.js";

export type ScrapedWebsite = {
  url: string;
  title?: string;
  markdown: string;
  metadata: Record<string, unknown>;
};

export const scrapeWebsiteByUrl = async (
  url: string,
): Promise<ScrapedWebsite> => {
  const apiKey = ENV.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "Website scraping is not configured.",
      "FIRECRAWL_NOT_CONFIGURED",
    );
  }

  const firecrawl = new Firecrawl({ apiKey });
  let result;

  try {
    result = await firecrawl.scrape(url, { formats: ["markdown"] });
  } catch (error) {
    console.error("Firecrawl website scrape failed:", error);
    throw new BadGatewayError(
      "The website could not be scraped. Check the URL and try again.",
      "WEBSITE_SCRAPE_FAILED",
    );
  }

  if (result.metadata?.error) {
    console.error("Firecrawl returned a scrape error:", result.metadata.error);
    throw new BadGatewayError(
      "The website could not be scraped. Check the URL and try again.",
      "WEBSITE_SCRAPE_FAILED",
    );
  }

  const markdown = result.markdown?.trim();
  if (!markdown) {
    throw new BadGatewayError(
      "The website did not provide any readable content.",
      "WEBSITE_CONTENT_EMPTY",
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
