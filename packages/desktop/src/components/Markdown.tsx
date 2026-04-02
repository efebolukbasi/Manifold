import { useMemo } from "react";
import type { Theme } from "../themes";

interface MarkdownProps {
  content: string;
  theme: Theme;
}

// ── Token types ────────────────────────────────────────

type Token =
  | { type: "codeblock"; lang: string; code: string }
  | { type: "paragraph"; inlines: InlineToken[] }
  | { type: "ul"; items: InlineToken[][] }
  | { type: "ol"; items: InlineToken[][] };

type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "bolditalic"; text: string };

// ── Block parser ───────────────────────────────────────

function parseBlocks(src: string): Token[] {
  const lines = src.split("\n");
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      tokens.push({ type: "codeblock", lang, code: codeLines.join("\n") });
      continue;
    }

    // Unordered list item
    if (/^[\s]*[-*]\s/.test(line)) {
      const items: InlineToken[][] = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^[\s]*[-*]\s/, "")));
        i++;
      }
      tokens.push({ type: "ul", items });
      continue;
    }

    // Ordered list item
    if (/^[\s]*\d+[.)]\s/.test(line)) {
      const items: InlineToken[][] = [];
      while (i < lines.length && /^[\s]*\d+[.)]\s/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^[\s]*\d+[.)]\s/, "")));
        i++;
      }
      tokens.push({ type: "ol", items });
      continue;
    }

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading — treat as bold paragraph
    const headingMatch = line.match(/^#{1,6}\s+(.*)/);
    if (headingMatch) {
      tokens.push({
        type: "paragraph",
        inlines: [{ type: "bold", text: headingMatch[1] }],
      });
      i++;
      continue;
    }

    // Regular paragraph (collect contiguous non-blank, non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^```/) &&
      !lines[i].match(/^[\s]*[-*]\s/) &&
      !lines[i].match(/^[\s]*\d+[.)]\s/) &&
      !lines[i].match(/^#{1,6}\s/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      tokens.push({ type: "paragraph", inlines: parseInline(paraLines.join("\n")) });
    }
  }

  return tokens;
}

// ── Inline parser ──────────────────────────────────────

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Match: inline code, bold+italic, bold, italic
  const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    const m = match[0];
    if (m.startsWith("`")) {
      tokens.push({ type: "code", text: m.slice(1, -1) });
    } else if (m.startsWith("***") || m.startsWith("___")) {
      tokens.push({ type: "bolditalic", text: m.slice(3, -3) });
    } else if (m.startsWith("**") || m.startsWith("__")) {
      tokens.push({ type: "bold", text: m.slice(2, -2) });
    } else {
      tokens.push({ type: "italic", text: m.slice(1, -1) });
    }
    lastIndex = match.index + m.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) });
  }

  return tokens;
}

// ── React renderer ─────────────────────────────────────

function InlineContent({ tokens, theme }: { tokens: InlineToken[]; theme: Theme }) {
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case "code":
            return (
              <code
                key={i}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontSize: "0.92em",
                  fontFamily:
                    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                }}
              >
                {t.text}
              </code>
            );
          case "bold":
            return (
              <strong key={i} style={{ fontWeight: 700 }}>
                {t.text}
              </strong>
            );
          case "italic":
            return (
              <em key={i} style={{ fontStyle: "italic" }}>
                {t.text}
              </em>
            );
          case "bolditalic":
            return (
              <strong key={i} style={{ fontWeight: 700, fontStyle: "italic" }}>
                {t.text}
              </strong>
            );
          default:
            return <span key={i}>{t.text}</span>;
        }
      })}
    </>
  );
}

export function Markdown({ content, theme }: MarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.6,
        color: theme.colors.fg,
        wordBreak: "break-word",
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      }}
    >
      {blocks.map((block, i) => {
        switch (block.type) {
          case "codeblock":
            return (
              <div key={i} style={{ position: "relative", margin: "6px 0" }}>
                {block.lang && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 10,
                      fontSize: 10,
                      opacity: 0.35,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      userSelect: "none",
                    }}
                  >
                    {block.lang}
                  </span>
                )}
                <pre
                  style={{
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: 6,
                    padding: "10px 14px",
                    overflowX: "auto",
                    fontSize: 12,
                    lineHeight: 1.5,
                    margin: 0,
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          case "ul":
            return (
              <ul
                key={i}
                style={{
                  margin: "4px 0",
                  paddingLeft: 20,
                  listStyleType: "disc",
                }}
              >
                {block.items.map((item, j) => (
                  <li key={j} style={{ marginBottom: 2 }}>
                    <InlineContent tokens={item} theme={theme} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={i}
                style={{
                  margin: "4px 0",
                  paddingLeft: 20,
                  listStyleType: "decimal",
                }}
              >
                {block.items.map((item, j) => (
                  <li key={j} style={{ marginBottom: 2 }}>
                    <InlineContent tokens={item} theme={theme} />
                  </li>
                ))}
              </ol>
            );
          case "paragraph":
            return (
              <p key={i} style={{ margin: "4px 0" }}>
                <InlineContent tokens={block.inlines} theme={theme} />
              </p>
            );
        }
      })}
    </div>
  );
}
