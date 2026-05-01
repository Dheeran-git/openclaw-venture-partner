export interface ScrapedLead {
  source_url: string;
  title: string;
  description: string;
  posted_at: Date;
  raw: unknown;
}

export interface Scraper {
  name: string;
  scrape(query: string, limit: number): Promise<ScrapedLead[]>;
}
