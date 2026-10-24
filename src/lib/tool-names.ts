/**
 * Tool output is filed by tool name, with MCP tools as `mcp__server__tool`
 * whichever agent called them. Shared by the server and the browser.
 */

/** Rough char→token ratio for estimates; transcripts rarely count result tokens. */
export const CHARS_PER_TOKEN = 4;

/** The `server` of an `mcp__server__tool` key, or null for a built-in tool. */
export function mcpServerOf(key: string): string | null {
  if (!key.startsWith("mcp__")) return null;
  const rest = key.slice("mcp__".length);
  const split = rest.indexOf("__");
  return split === -1 ? rest : rest.slice(0, split);
}

/** `server › tool` for an MCP key, the name itself otherwise. */
export function toolLabel(key: string): string {
  const server = mcpServerOf(key);
  if (server === null) return key;
  const tool = key.slice(`mcp__${server}__`.length);
  return tool ? `${server} › ${tool}` : server;
}

/**
 * What a tool's footprint cost: re-sending its input and results, plus the
 * model writing its input. Null when neither could be priced.
 */
export function toolCostUSD(row: { carriedUSD: number | null; inputUSD: number | null }): number | null {
  if (row.carriedUSD === null && row.inputUSD === null) return null;
  return (row.carriedUSD ?? 0) + (row.inputUSD ?? 0);
}
