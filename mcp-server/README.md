# nemovizor-mcp

Model Context Protocol server for [Nemovizor](https://nemovizor.cz) — the Czech & Slovak real-estate platform. It lets AI agents (Claude Desktop, Cursor, Claude Code, custom agents) search listings, fetch map points, look up filter options, and parse natural-language queries, **without scraping HTML**.

## Tools exposed

| Tool | What it does |
|---|---|
| `nemovizor_search_properties` | Paginated property search with filters (listing type, category, subtype, city/country, price/area ranges, map bbox, sort). |
| `nemovizor_map_points` | Lightweight lat/lon pins for map rendering. Zoom-aware. |
| `nemovizor_filter_options` | Faceted search metadata — available categories, subtypes, cities, price/area ranges with counts. |
| `nemovizor_ai_search` | Convert a free-form natural-language query (any language) into structured filters. |

All four tools wrap the public API documented by the OpenAPI spec at [`https://nemovizor.cz/api/openapi`](https://nemovizor.cz/api/openapi).

## Configuration

Environment variables:

- `NEMOVIZOR_BASE_URL` — base URL to hit. Default: `https://nemovizor.cz`. Point at `http://localhost:3000` for local development.
- `NEMOVIZOR_API_KEY` — optional bearer token (reserved for a future private tier; the tier-1 endpoints are public).

## Install

```bash
cd mcp-server
npm install
npm run build
```

After `npm run build`, the executable lives at `mcp-server/dist/index.js`.

## Use with Claude Desktop

Edit your `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add an entry under `mcpServers`:

```json
{
  "mcpServers": {
    "nemovizor": {
      "command": "node",
      "args": ["/absolute/path/to/nemovizor-mvp/mcp-server/dist/index.js"],
      "env": {
        "NEMOVIZOR_BASE_URL": "https://nemovizor.cz"
      }
    }
  }
}
```

Restart Claude Desktop. The four `nemovizor_*` tools should appear in the tool picker.

## Use with Cursor

Add the server to `~/.cursor/mcp.json` (same JSON shape as Claude Desktop).

## Use with Claude Code

In a project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "nemovizor": {
      "command": "node",
      "args": ["/absolute/path/to/nemovizor-mvp/mcp-server/dist/index.js"]
    }
  }
}
```

## Example prompts

- *"Find me apartments 3+kk in Prague under 8 million CZK using Nemovizor."*
- *"Show a map of houses for sale in Bratislava between 200k and 400k EUR."*
- *"What subtypes of apartments are available in Brno right now?"*

Behind the scenes the agent typically:

1. Calls `nemovizor_ai_search` with the user's query → receives structured `{ listingType, category, city, priceMax, … }`.
2. Feeds those into `nemovizor_search_properties` → receives paginated listings.
3. (Optional) Uses `nemovizor_map_points` to render pins on a map.

## Development

```bash
npm run dev      # tsc --watch
npm run build    # one-shot build
npm start        # run the built server over stdio
```

## License

MIT
