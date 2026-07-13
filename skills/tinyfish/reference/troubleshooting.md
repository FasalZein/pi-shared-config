# TinyFish Troubleshooting & Configuration

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| No results | Query too specific or no matching content | Broaden query, try without location/language filters |
| 429 Too Many Requests | Rate limit exceeded | Script auto-retries with next API key; fails only after all keys exhausted |
| 401 Unauthorized | Invalid or missing API key | Check TINYFISH_API_KEY is set correctly |
| 402 Payment Required | Insufficient credits | Top up at https://agent.tinyfish.ai/api-keys |
| 403 Forbidden | Search/Fetch access not enabled | Verify account has access to the specific API |
| 400 Bad Request | Invalid parameters | Check URL format and parameter values |
| 5xx Server Error | TinyFish service issue | Retry after brief wait |

## Environment Configuration

```bash
# Single API key
export TINYFISH_API_KEY="your-key-here"

# Multiple API keys (comma-separated) - rotated with automatic 429 failover
export TINYFISH_API_KEY="key1,key2,key3"

# Get a key at: https://agent.tinyfish.ai/api-keys
```

## Rate Limits

| Plan | Search (req/min) | Fetch (URLs/min) |
|------|-----------------|-------------------|
| Free | 30 | 150 |
| Pay As You Go | 30 | 150 |
| Starter | 60 | 300 |
| Pro | 120 | 600 |

*Rate limits apply per API key.*

## Common Issues

### Query Specificity

Poor queries return irrelevant results. Be specific:

| Bad Query | Good Query |
|-----------|------------|
| "AI" | "latest LLM research papers on context windows" |
| "React" | "React 19 Server Components migration guide" |
| "tools" | "web automation tools site:github.com" |

### Site Scoping

Use search operators to scope or exclude results:

| Operator | Example | Effect |
|----------|---------|--------|
| `site:` | `python tutorial site:docs.python.org` | Results only from that domain |
| `-site:` | `recipe ideas -site:facebook.com` | Excludes results from that domain |

### Geo-Targeting

| Parameters | Effect |
|------------|--------|
| `location=US language=en` | US results in English |
| `location=FR language=fr` | French results in French |
| `language=ja` (no location) | Auto-resolves to location=JP |
| `location=BR` (no language) | Auto-resolves to language=pt |

### Fetch Tips

- **Max 10 URLs** per request — batch larger sets into multiple calls
- **Per-URL failures don't fail the batch** — check `errors[]` array
- **110s per-URL timeout** — slow pages return a `timeout` error
- **120s CDN ceiling** for the full batch — set client timeout to 150s
- **Supported content**: HTML, PDF (text extraction), JSON, plain text
- **Not supported**: Binary files (images, video) — returns error

### Search vs Fetch

| Need | Use |
|------|-----|
| Find relevant URLs | `search` |
| Extract content from known URLs | `fetch` |
| Find URLs + get content | `search` then `fetch` |

## Environment Variable Requirement

The `TINYFISH_API_KEY` env var **must be exported** before pi launches. Add it to your shell profile (`.zshrc`, `.bashrc`, `.profile`, or `~/.config/fish/config.fish`):

```bash
export TINYFISH_API_KEY="key1,key2,key3"
```

If pi launches from a desktop environment, tmux without a login shell, or a non-interactive context, the key may not be set. In that case, source your profile first or set the var explicitly in the launcher config.

To check whether the key is set in your current shell:
```bash
echo "${TINYFISH_API_KEY:+SET}"  # prints "SET" if set, empty otherwise
```

## Script Timeouts

- **Search requests**: 30-second timeout (typical latency 1-3s)
- **Fetch requests**: 150-second timeout (backend has 110s per URL + 120s CDN ceiling)
- For large fetch batches, the script waits for the full response

## Billing

- **Search**: Does not use credits
- **Fetch**: Does not use credits
