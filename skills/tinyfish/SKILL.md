---
name: tinyfish
description: Searches the web and extracts page content. Use when needing real-time web search results, fetching and extracting clean content from URLs, or scraping JavaScript-heavy pages. Best for web search, content extraction, and combining search results with full page content in a single workflow.
---

# TinyFish Web Search & Fetch

Search the web and extract full page content via the TinyFish API. Returns complete content with no truncation, author metadata, and published dates.

## When to Use

| Situation | Use TinyFish | Don't use TinyFish |
|---|---|---|
| Fetch full page content | `fetch` — returns 5-7x more than alternatives | — |
| Quick web search | `search` for simple queries | Use Exa for semantic/research queries |
| Batch fetch ≤10 URLs | `fetch` multiple URLs in one call | — |
| Fetch PDFs | — | Use Firecrawl (TinyFish returns binary) |
| Discover all URLs on a site | — | Use Firecrawl `map` |
| Semantic/neural search | — | Use Exa `search` |

**TinyFish is the best fetcher. Exa is the best searcher. Use both together.**

## Protocol

### Web Search

```bash
scripts/tinyfish.sh search "<query>" [location] [language] [page]
```

**Parameters:**
- `query` (required) — Search query. Supports `site:` and `-site:` operators
- `location` (optional) — Country code (US, GB, FR, DE, etc.)
- `language` (optional) — Language code (en, fr, de, etc.)
- `page` (optional) — Page number (0-indexed, max 10)

**Examples:**
```bash
scripts/tinyfish.sh search "AI agent memory systems 2026"
scripts/tinyfish.sh search "web automation tools" US en
scripts/tinyfish.sh search "python tutorial site:docs.python.org"
```

### Fetch Page Content

```bash
scripts/tinyfish.sh fetch "<url1>" ["<url2>"] [--format markdown|html|json] [--links] [--image-links]
```

**Output includes:** Title, URL, Description, Author, Published date, Language, and full page content.

**Parameters:**
- `urls` (required) — One or more URLs (max 10 per request)
- `--format` — Output format: `markdown` (default), `html`, `json`
- `--links` — Include all outbound URLs
- `--image-links` — Include all image URLs

**Examples:**
```bash
scripts/tinyfish.sh fetch "https://example.com" --format markdown
scripts/tinyfish.sh fetch "https://a.com" "https://b.com" "https://c.com" --links
```

### Validate API Keys

```bash
scripts/tinyfish.sh validate
```

## Key Strengths

- **Full content** — No output truncation. Returns complete page text.
- **Author + date metadata** — Every fetch includes author and published_date when available.
- **JS rendering** — Handles JavaScript-heavy pages that curl cannot.
- **Batch fetching** — Up to 10 URLs in a single request.
- **High rate limits** — 30 req/min search, 150 URLs/min fetch on free tier.

## Critical Rules

1. **TinyFish for fetching HTML pages** — Returns 5-7x more content than alternatives
2. **Search first, fetch second** — Use `search` to find URLs, then `fetch` for content
3. **Max 10 URLs per fetch** — Batch up to 10 URLs in a single request
4. **Fetch timeout is 150s** — 110s per-URL backend timeout, 120s CDN ceiling
5. **Cannot fetch PDFs** — Returns raw binary for PDFs. Use Firecrawl for PDF content.
6. **No guessing** — If search returns nothing, rephrase or ask user

## Resources

See `reference/troubleshooting.md` for rate limits, error handling, and configuration.
