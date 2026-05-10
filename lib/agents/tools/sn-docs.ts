import { MCPServerStreamableHttp } from "@openai/agents";

export function makeSnDocsServer(opts?: {
  blockedToolNames?: string[];
}): MCPServerStreamableHttp {
  const url = process.env.SN_DOCS_MCP_URL;
  if (!url) {
    throw new Error("SN_DOCS_MCP_URL is not set");
  }
  const apiKey = process.env.SN_DOCS_API_KEY;
  return new MCPServerStreamableHttp({
    url,
    name: "sn-docs",
    cacheToolsList: true,
    requestInit: apiKey
      ? { headers: { Authorization: `Bearer ${apiKey}` } }
      : undefined,
    toolFilter: opts?.blockedToolNames
      ? { blockedToolNames: opts.blockedToolNames }
      : undefined,
  });
}
