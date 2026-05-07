import { extractText } from "unpdf";
import mammoth from "mammoth";

export async function extractDocumentText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const result = await extractText(new Uint8Array(buf));
    const text = Array.isArray(result.text)
      ? result.text.join("\n\n")
      : result.text;
    return text.trim();
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value.trim();
  }

  if (
    file.type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    return new TextDecoder().decode(buf).trim();
  }

  throw new Error(
    `Unsupported file type${file.type ? ` (${file.type})` : ""}. Use PDF, DOCX, TXT, or MD.`,
  );
}
