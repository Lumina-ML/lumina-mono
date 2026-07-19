/**
 * Block schema used by the Report editor. Each block is a small JSON object
 * stored on `Report.blocks` (an Array<Record>). Keeping the schema flat and
 * versioned lets us add new block types without breaking old reports.
 */

export type BlockType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "paragraph"
  | "divider"
  | "code"
  | "image"
  | "chart"
  | "callout";

export interface BaseBlock<T extends BlockType, D> {
  /** Stable id used by the editor for keyed updates. */
  id: string;
  type: T;
  data: D;
}

export type HeadingBlock = BaseBlock<
  "heading1" | "heading2" | "heading3",
  { text: string }
>;
export type ParagraphBlock = BaseBlock<"paragraph", { text: string }>;
export type DividerBlock = BaseBlock<"divider", Record<string, never>>;
export type CodeBlock = BaseBlock<
  "code",
  { language: string; source: string }
>;
export type ImageBlock = BaseBlock<
  "image",
  { src: string; alt: string; caption?: string }
>;
export type ChartBlock = BaseBlock<
  "chart",
  {
    runId: string;
    metricKey: string;
    title?: string;
    /** ChartConfig (passed through to ChartRenderer). */
    config?: Record<string, unknown>;
  }
>;
export type CalloutBlock = BaseBlock<
  "callout",
  { variant: "info" | "warning" | "success" | "error"; text: string }
>;

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | DividerBlock
  | CodeBlock
  | ImageBlock
  | ChartBlock
  | CalloutBlock;

export function uid(): string {
  return `b-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeBlock(type: BlockType): Block {
  switch (type) {
    case "heading1":
      return { id: uid(), type, data: { text: "" } };
    case "heading2":
      return { id: uid(), type, data: { text: "" } };
    case "heading3":
      return { id: uid(), type, data: { text: "" } };
    case "paragraph":
      return { id: uid(), type, data: { text: "" } };
    case "divider":
      return { id: uid(), type, data: {} };
    case "code":
      return { id: uid(), type, data: { language: "python", source: "" } };
    case "image":
      return { id: uid(), type, data: { src: "", alt: "" } };
    case "chart":
      return {
        id: uid(),
        type,
        data: { runId: "", metricKey: "", title: "" },
      };
    case "callout":
      return { id: uid(), type, data: { variant: "info", text: "" } };
  }
}

/**
 * Serialize the block list to Markdown. Chart / image / divider blocks are
 * rendered as placeholders — full export to HTML is out of scope for v1.
 */
export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading1":
        out.push(`# ${b.data.text}\n`);
        break;
      case "heading2":
        out.push(`## ${b.data.text}\n`);
        break;
      case "heading3":
        out.push(`### ${b.data.text}\n`);
        break;
      case "paragraph":
        out.push(`${b.data.text}\n`);
        break;
      case "divider":
        out.push(`---\n`);
        break;
      case "code":
        out.push(`\`\`\`${b.data.language}\n${b.data.source}\n\`\`\`\n`);
        break;
      case "image":
        out.push(
          b.data.caption
            ? `![${b.data.alt}](${b.data.src})\n*${b.data.caption}*\n`
            : `![${b.data.alt}](${b.data.src})\n`,
        );
        break;
      case "chart":
        out.push(
          `> 📊 **${b.data.title ?? "Chart"}** — \`run:${b.data.runId}\` · \`${b.data.metricKey}\`\n`,
        );
        break;
      case "callout":
        out.push(`> **${b.data.variant.toUpperCase()}**: ${b.data.text}\n`);
        break;
    }
  }
  return out.join("\n");
}

/** Cast raw Record<string, unknown> array to typed Block[]. */
export function coerceBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as { id?: unknown; type?: unknown; data?: unknown };
    if (typeof obj.id !== "string" || typeof obj.type !== "string") continue;
    const block = makeBlock(obj.type as BlockType) as Block;
    block.id = obj.id;
    if (obj.data && typeof obj.data === "object") {
      Object.assign(block.data as object, obj.data);
    }
    out.push(block);
  }
  return out;
}