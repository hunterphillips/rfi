import fs from "node:fs/promises";
import path from "node:path";

let cached: string | null = null;

export async function loadIpcProfile(): Promise<string> {
  if (cached) return cached;
  const p = path.join(process.cwd(), "lib", "ipc-profile.md");
  cached = await fs.readFile(p, "utf8");
  return cached;
}
