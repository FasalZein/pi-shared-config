# Superlight TinyFish Skill

Search the web and extract page content via the TinyFish API. A superlight agent skill for AI coding assistants — minimal tokens, maximum web data. Supports multiple API keys with round-robin rotation and automatic 429 failover.

## Features

- **Web search** — Ranked search results with titles, snippets, and URLs
- **Page content extraction** — Fetch clean Markdown, HTML, or structured JSON from URLs
- **JavaScript rendering** — Handles JS-heavy and dynamic web pages via real browser
- **Geo-targeted search** — Country and language-specific results
- **Search + fetch pipeline** — Find URLs then extract full content in one workflow
- **Batch fetching** — Up to 10 URLs per request with independent per-URL error handling
- **Token-efficient** — Minimal context overhead with progressive disclosure
- **Multi-key rotation** — Round-robin distribution with automatic 429 failover

## Why Use This Over TinyFish MCP?

| Aspect | MCP Server | This Skill |
|--------|------------|------------|
| Context cost | **~1,154 tokens always**¹ | **~67–94 tokens always** + ~949–1,441 on-demand |
| Tool schemas | Always in context | None (progressive disclosure) |
| Setup | Requires MCP configuration | Drop-in skill directory |
| Dependencies | Node.js runtime | bash, curl, jq (Linux/macOS) |

¹ *Measured from TinyFish MCP `tools/list` response (4 tools: search, fetch_content, run_web_automation, create_browser_session). Actual cost depends on your model — 1,154 on Claude Opus 4.7, 947 on Opus 4.6, 818 on GPT-5.x.*

Best for: Users who need web search and scraping on-demand without persistent context overhead.

## Token Budget

Uses Claude's [progressive disclosure](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills) architecture:

| Level | When Loaded | Content | Opus 4.7 | Opus 4.6 | GPT-5.x |
|-------|-------------|---------|---------:|---------:|--------:|
| **Metadata** | Always (startup) | Skill description | 94 | 67 | 59 |
| **Instructions** | When triggered | SKILL.md protocol | 1,441 | 1,033 | 949 |
| **Resources** | As needed | troubleshooting.md | 1,515 | 1,106 | 981 |

*Token counts measured with [claudetokenizer.com](https://www.claudetokenizer.com/) (Claude Opus 4.7, Opus 4.6) and [platform.openai.com/tokenizer](https://platform.openai.com/tokenizer) (GPT-5.x)*

## Install

```bash
npx skills add edxeth/superlight-tinyfish-skill
```

## Usage

The skill triggers automatically when searching the web or extracting page content:

```
"Search the web for the latest AI research papers"
"Fetch the content from this URL and extract it as markdown"
"Find pages about web automation and extract their content"
"Search for Python tutorials on docs.python.org"
```

### Manual Invocation

```bash
# Web search
./scripts/tinyfish.sh search "web automation tools" US en
./scripts/tinyfish.sh search "best restaurants" FR fr
./scripts/tinyfish.sh search "python tutorial site:docs.python.org"

# Fetch page content
./scripts/tinyfish.sh fetch "https://example.com"
./scripts/tinyfish.sh fetch "https://example.com" "https://example2.com" --format html --links

# Pipeline: search then fetch
./scripts/tinyfish.sh search "TinyFish web agent" US en
./scripts/tinyfish.sh fetch "https://result1.com" "https://result2.com"
```

## API Endpoints

Uses TinyFish REST API:

| Endpoint | Purpose | Rate Limit (Free) |
|----------|---------|-------------------|
| `GET https://api.search.tinyfish.ai` | Web search | 30 req/min |
| `POST https://api.fetch.tinyfish.ai` | Page content extraction | 150 URLs/min |

## Configuration

API key is **required**.

```bash
# Single API key
export TINYFISH_API_KEY="your-key-here"

# Multiple API keys for load distribution
export TINYFISH_API_KEY="key1,key2,key3"
```

When multiple keys are provided (comma-separated), the script rotates through them in round-robin order, ensuring even distribution of requests. If a key hits rate limits (429), the script automatically fails over to the next key and retries, only failing after all keys are exhausted across multiple retry rounds.

Get an API key at [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys).

## License

MIT License
