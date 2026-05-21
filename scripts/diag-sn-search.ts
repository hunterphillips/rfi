// Run with: pnpm dlx tsx --env-file=.env.local scripts/diag-sn-search.ts
// Quick raw probe of sn_search_docs behavior on the queries the researcher
// eval is failing on.
import { MCPServerStreamableHttp } from "@openai/agents";

const queries: { query: string; bundle?: string | null }[] = [
  { query: "Now Assist for ITSM AI case summarization features" },
  { query: "ServiceNow change management approval workflow" },
  { query: "Predictive Intelligence classification model training" },
  { query: "Performance Analytics scorecards indicators dashboards" },
  { query: "incident management dashboards", bundle: "vancouver-itsm" },
  { query: "change management" }, // sanity: a maximally simple query
  { query: "incident" },
];

async function main() {
  const url = process.env.SN_DOCS_MCP_URL;
  const key = process.env.SN_DOCS_API_KEY;
  if (!url) throw new Error("SN_DOCS_MCP_URL missing");

  const server = new MCPServerStreamableHttp({
    url,
    name: "sn-docs",
    cacheToolsList: true,
    requestInit: key
      ? { headers: { Authorization: `Bearer ${key}` } }
      : undefined,
  });

  await server.connect();
  console.log(`[diag] connected; running ${queries.length} probes`);
  console.log();

  for (const q of queries) {
    const args: Record<string, unknown> = {
      query: q.query,
      response_format: "json",
    };
    if (q.bundle) args.bundle = q.bundle;
    const t0 = Date.now();
    let raw: unknown;
    try {
      raw = await server.callTool("sn_search_docs", args);
    } catch (e) {
      console.log(
        `[diag] FAIL ${q.query}${q.bundle ? ` [${q.bundle}]` : ""} — ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    const dt = Date.now() - t0;
    const content = raw as { type: string; text: string }[];
    const text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    let resultCount = 0;
    let firstItem: unknown = null;
    let firstKeys: string[] = [];
    try {
      const parsed: unknown = JSON.parse(text);
      const arr = Array.isArray(parsed)
        ? parsed
        : (parsed as { results?: unknown[] })?.results;
      if (Array.isArray(arr)) {
        resultCount = arr.length;
        firstItem = arr[0] ?? null;
        if (firstItem && typeof firstItem === "object") {
          firstKeys = Object.keys(firstItem as Record<string, unknown>);
        }
      }
    } catch {
      // text not JSON
    }
    console.log(
      `[diag] ${dt.toString().padStart(5)}ms  results=${resultCount}  ${q.query}${q.bundle ? ` [${q.bundle}]` : ""}`,
    );
    if (resultCount > 0) {
      console.log(`         keys: ${firstKeys.join(", ")}`);
      console.log(
        `         first: ${JSON.stringify(firstItem).slice(0, 400)}`,
      );
    } else {
      console.log(`         raw_text: ${text.slice(0, 200)}`);
    }
  }

  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
