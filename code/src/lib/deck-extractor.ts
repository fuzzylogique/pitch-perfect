import path from "path";
import JSZip from "jszip";

const MAX_DECK_TEXT_CHARS = 80_000;
const PPTX_TEXT_REGEX = /<a:t[^>]*>(.*?)<\/a:t>/g;

type DeckExtractionResult = {
  text?: string;
  warning?: string;
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function decodeXml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function truncateText(text: string): DeckExtractionResult {
  if (text.length <= MAX_DECK_TEXT_CHARS) {
    return { text };
  }
  return {
    text: text.slice(0, MAX_DECK_TEXT_CHARS),
    warning: `Deck text truncated to ${MAX_DECK_TEXT_CHARS} characters.`,
  };
}

function isPdf(mimeType: string, ext: string) {
  return mimeType === "application/pdf" || ext === ".pdf";
}

function isPptx(mimeType: string, ext: string) {
  return (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === ".pptx"
  );
}

function isPpt(mimeType: string, ext: string) {
  return mimeType === "application/vnd.ms-powerpoint" || ext === ".ppt";
}

async function extractPdfText(buffer: Buffer): Promise<DeckExtractionResult> {
  const pdfModule = await import("pdf-parse");
  const pdfParse = (pdfModule as { default?: (data: Buffer) => Promise<{ text?: string }> })
    .default;
  if (!pdfParse) {
    return { warning: "PDF parser not available." };
  }
  const result = await pdfParse(buffer);
  const text = normalizeText(result.text ?? "");
  if (!text) {
    return { warning: "No text extracted from PDF." };
  }
  return truncateText(text);
}

async function extractPptxText(buffer: Buffer): Promise<DeckExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return aNum - bNum;
    });

  const slideTexts: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.file(name)?.async("string");
    if (!xml) {
      continue;
    }
    const matches = Array.from(xml.matchAll(PPTX_TEXT_REGEX));
    const text = matches.map((match) => decodeXml(match[1])).join(" ").trim();
    if (text) {
      slideTexts.push(text);
    }
  }

  const combined = normalizeText(slideTexts.join("\n"));
  if (!combined) {
    return { warning: "No text extracted from PPTX." };
  }
  return truncateText(combined);
}

export async function extractDeckText(params: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<DeckExtractionResult> {
  const mimeType = params.mimeType.toLowerCase();
  const ext = path.extname(params.originalName).toLowerCase();

  if (isPdf(mimeType, ext)) {
    return extractPdfText(params.buffer);
  }

  if (isPptx(mimeType, ext)) {
    return extractPptxText(params.buffer);
  }

  if (isPpt(mimeType, ext)) {
    return {
      warning: "Legacy .ppt files are not supported. Please upload .pptx or .pdf.",
    };
  }

  return {
    warning: `Unsupported deck file type (${mimeType || ext || "unknown"}).`,
  };
}
