/**
 * Formato simples para voluntários (sem editor complexo): parágrafos separados por linha em
 * branco, "## " subtítulo, "> " citação, "- " lista, **negrito**, *itálico*, [texto](https://link),
 * e imagem da biblioteca sozinha numa linha: ![descrição](/midia/<id>/arquivo.webp) — com legenda opcional
 * na linha seguinte começando com "— ".
 * O HTML resultante ainda passa por sanitizeRichText no servidor.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

export function textToHtml(text: string): string {
  return text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/).map((block) => {
    const lines = block.split("\n");
    const img = /^!\[([^\]]*)\]\(\/midia\/([0-9a-f-]{36})\/arquivo\.webp\)$/.exec(lines[0].trim());
    if (img && (lines.length === 1 || (lines.length === 2 && lines[1].startsWith("— ")))) {
      const [, alt, id] = img;
      const base = `/midia/${id}`;
      const cap = lines[1] ? `<figcaption>${inline(lines[1].slice(2))}</figcaption>` : "";
      return `<figure><img src="${base}/arquivo.webp" srcset="${base}/w640/arquivo.webp 640w, ${base}/w1280/arquivo.webp 1280w, ${base}/arquivo.webp 2400w" sizes="(max-width: 720px) 100vw, 720px" alt="${esc(alt)}" loading="lazy" decoding="async">${cap}</figure>`;
    }
    if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
    if (block.startsWith("### ")) return `<h3>${inline(block.slice(4))}</h3>`;
    if (lines.every((l) => l.startsWith("> "))) return `<blockquote><p>${lines.map((l) => inline(l.slice(2))).join("<br>")}</p></blockquote>`;
    if (lines.every((l) => /^[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  }).join("\n");
}

/** Conversão inversa aproximada para reabrir no editor de texto. */
export function htmlToText(html: string): string {
  return html
    .replace(/<figure><img [^>]*?src="(\/midia\/[0-9a-f-]{36}\/arquivo\.webp)"[^>]*?alt="([^"]*)"[^>]*>(?:<figcaption>(.*?)<\/figcaption>)?<\/figure>/g,
      (_m, src, alt, cap) => `![${alt}](${src})${cap ? `
— ${cap}` : ""}

`)
    .replace(/<h2>(.*?)<\/h2>/g, "## $1\n\n").replace(/<h3>(.*?)<\/h3>/g, "### $1\n\n")
    .replace(/<blockquote><p>(.*?)<\/p><\/blockquote>/g, (_m, p) => p.split("<br>").map((l: string) => `> ${l}`).join("\n") + "\n\n")
    .replace(/<ul>(.*?)<\/ul>/g, (_m, p) => p.replace(/<li>(.*?)<\/li>/g, "- $1\n") + "\n")
    .replace(/<ol>(.*?)<\/ol>/g, (_m, p) => { let i = 0; return p.replace(/<li>(.*?)<\/li>/g, (_x: string, t: string) => `${++i}. ${t}\n`) + "\n"; })
    .replace(/<p>(.*?)<\/p>/g, (_m, p) => p.replace(/<br\s*\/?>/g, "\n") + "\n\n")
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**").replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n").trim();
}
