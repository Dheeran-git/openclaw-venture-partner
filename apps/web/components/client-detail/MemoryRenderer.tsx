"use client";

/**
 * Tiny markdown renderer for clients.memory_md. We support the four
 * structures the agent's update logic emits — h1, h2, bullets, and
 * paragraphs — without pulling in a markdown dependency.
 */
export function MemoryRenderer({ md }: { md: string }) {
  const lines = md.split(/\r?\n/);
  const out: React.ReactElement[] = [];
  let listBuf: string[] = [];
  let paraBuf: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuf.length === 0) return;
    out.push(
      <ul key={key++} style={{ margin: "4px 0 12px 18px", padding: 0, color: "var(--fg-secondary)", fontSize: 13, lineHeight: 1.65 }}>
        {listBuf.map((li, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{li}</li>
        ))}
      </ul>
    );
    listBuf = [];
  }
  function flushPara() {
    if (paraBuf.length === 0) return;
    out.push(
      <p key={key++} style={{ margin: "0 0 12px", color: "var(--fg-secondary)", fontSize: 13, lineHeight: 1.65 }}>
        {paraBuf.join(" ")}
      </p>
    );
    paraBuf = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("# ")) {
      flushList();
      flushPara();
      out.push(
        <h1
          key={key++}
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--fg-primary)",
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      flushPara();
      out.push(
        <h2
          key={key++}
          className="oc-mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--fg-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("- ")) {
      flushPara();
      listBuf.push(line.slice(2));
    } else if (line.length === 0) {
      flushList();
      flushPara();
    } else {
      flushList();
      paraBuf.push(line);
    }
  }
  flushList();
  flushPara();

  return <div>{out}</div>;
}
