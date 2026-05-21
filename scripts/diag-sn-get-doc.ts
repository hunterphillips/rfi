// Run with: pnpm dlx tsx --env-file=.env.local scripts/diag-sn-get-doc.ts
// Probe sn_get_doc with response_format: "json" to learn the shape.
import { MCPServerStreamableHttp } from "@openai/agents";

const URLS = [
  "https://www.servicenow.com/docs/en-US/bundle/vancouver-it-service-management/page/product/change-management/concept/using-change-management.html",
  "https://www.servicenow.com/docs/en-US/bundle/vancouver-intelligent-experiences/page/administer/predictive-intelligence/concept/predictive-intelligence.html",
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
  console.log("[diag] connected");

  for (const u of URLS) {
    for (const fmt of ["markdown", "json"] as const) {
      const t0 = Date.now();
      let raw: unknown;
      try {
        raw = await server.callTool("sn_get_doc", {
          url: u,
          response_format: fmt,
        });
      } catch (e) {
        console.log(`[diag] FAIL ${fmt} ${u} — ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const dt = Date.now() - t0;
      const content = raw as { type: string; text: string }[];
      const text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      console.log();
      console.log(`[diag] ${fmt.padEnd(8)} ${dt}ms  len=${text.length}  url=${u.split("/page/")[1] ?? u}`);
      if (fmt === "json") {
        try {
          const parsed = JSON.parse(text) as unknown;
          if (Array.isArray(parsed)) {
            console.log(`         shape: array of ${parsed.length} chunk(s)`);
            const first = parsed[0] as Record<string, unknown> | undefined;
            if (first) {
              console.log(`         chunk[0] keys: ${Object.keys(first).join(", ")}`);
              for (const [k, v] of Object.entries(first)) {
                const summary =
                  typeof v === "string"
                    ? `string(${v.length} chars): ${JSON.stringify(v.slice(0, 120))}${v.length > 120 ? "…" : ""}`
                    : `${typeof v}: ${JSON.stringify(v).slice(0, 120)}`;
                console.log(`           ${k} = ${summary}`);
              }
            }
            if (parsed.length > 1) {
              const second = parsed[1] as Record<string, unknown>;
              console.log(`         chunk[1] keys: ${Object.keys(second).join(", ")}, chunk_index=${second.chunk_index}`);
            }
          } else if (parsed && typeof parsed === "object") {
            console.log(`         shape: object`);
            console.log(`         keys: ${Object.keys(parsed as Record<string, unknown>).join(", ")}`);
          }
        } catch (e) {
          console.log(`         JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        console.log(`         preview: ${text.replace(/\n/g, " ").slice(0, 300)}`);
      }
    }
  }

  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
