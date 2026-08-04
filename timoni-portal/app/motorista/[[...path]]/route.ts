import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FILES = new Map<string, string>([
  ["index.html", "text/html; charset=utf-8"],
  ["app.css", "text/css; charset=utf-8"],
  ["app.js", "text/javascript; charset=utf-8"],
  ["lib/store.js", "text/javascript; charset=utf-8"],
  ["icons/icon48.png", "image/png"],
]);

function injectPortalNavigation(html: string, css: string) {
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const inlineStyles = `
<base href="/motorista/">
<style data-motorista-inline>
${safeCss}
.portal-back{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.14);color:#fff!important;text-decoration:none;font-size:12px;font-weight:700;white-space:nowrap}
.portal-back:hover{background:rgba(255,255,255,.22)}
@media(max-width:600px){.portal-back{font-size:11px;padding:6px 9px}.brand-title{font-size:13px}}
</style>`;

  return html
    .replace(/<link[^>]+href=["']app\.css(?:\?[^"']*)?["'][^>]*>/i, "")
    .replaceAll("?v=4", "?v=6")
    .replaceAll("?v=5", "?v=6")
    .replace("</head>", `${inlineStyles}</head>`)
    .replace(
      '<div class="topbar-actions" id="lojaPillWrap" hidden>',
      '<div style="display:flex;align-items:center;gap:8px"><a class="portal-back" href="/dashboard">← Voltar ao Portal</a><div class="topbar-actions" id="lojaPillWrap" hidden>',
    )
    .replace("</header>", "</div></header>");
}

async function fetchMotoristaFile(ref: string, filePath: string, accept: string) {
  const safePath = filePath.split("/").map(encodeURIComponent).join("/");
  const sourceUrl = `https://raw.githubusercontent.com/mcrodini-Hub/portaltimoni/${ref}/motorista/${safePath}`;

  return fetch(sourceUrl, {
    headers: { Accept: accept },
    next: { revalidate: 300 },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  const filePath = path?.length ? path.join("/") : "index.html";
  const contentType = ALLOWED_FILES.get(filePath);

  if (!contentType) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const ref = process.env.VERCEL_GIT_COMMIT_SHA || "main";
  const source = await fetchMotoristaFile(ref, filePath, contentType);

  if (!source.ok) {
    return NextResponse.json(
      { error: "A Agenda do Motorista não pôde ser carregada." },
      { status: 502 },
    );
  }

  if (filePath === "index.html") {
    const cssSource = await fetchMotoristaFile(ref, "app.css", "text/css");

    if (!cssSource.ok) {
      return NextResponse.json(
        { error: "O estilo da Agenda do Motorista não pôde ser carregado." },
        { status: 502 },
      );
    }

    const html = injectPortalNavigation(await source.text(), await cssSource.text());
    return new NextResponse(html, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  return new NextResponse(await source.arrayBuffer(), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
