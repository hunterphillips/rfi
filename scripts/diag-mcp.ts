// Run with:  pnpm exec tsx --env-file=.env.local scripts/diag-mcp.ts
import { MCPServerStreamableHttp } from "@openai/agents";

async function main() {
  const url = process.env.SN_DOCS_MCP_URL;
  const key = process.env.SN_DOCS_API_KEY;
  if (!url) throw new Error("SN_DOCS_MCP_URL missing");

  console.log("[mcp] url=%s key_len=%d", url, key?.length ?? 0);
  const server = new MCPServerStreamableHttp({
    url,
    name: "sn-docs",
    cacheToolsList: true,
    requestInit: key
      ? { headers: { Authorization: `Bearer ${key}` } }
      : undefined,
  });

  const t0 = Date.now();
  console.log("[mcp] connect()…");
  await server.connect();
  console.log("[mcp] connected in %dms", Date.now() - t0);

  const t1 = Date.now();
  console.log("[mcp] listTools()…");
  const tools = await server.listTools();
  console.log(
    "[mcp] listTools done in %dms, %d tools: %s",
    Date.now() - t1,
    tools.length,
    tools.map((t) => t.name).join(", "),
  );

  await server.close();
  console.log("[mcp] closed");
}

main().catch((e) => {
  console.error("[mcp] ERROR", e);
  process.exit(1);
});
