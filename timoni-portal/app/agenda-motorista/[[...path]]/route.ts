import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FILES = new Map<string, string>([
  ["index.html", "text/html; charset=utf-8"],
  ["app.css", "text/css; charset=utf-8"],
  ["app.js", "text/javascript; charset=utf-8"],
  ["lib/store.js", "text/javascript; charset=utf-8"],
]);

async function fetchAgendaFile(ref: string, filePath: string, accept: string) {
  const safePath = filePath.split("/").map(encodeURIComponent).join("/");
  const sourceUrl = `https://raw.githubusercontent.com/mcrodini-Hub/portaltimoni/${ref}/agenda-motorista/${safePath}`;
  return fetch(sourceUrl, { headers: { Accept: accept }, next: { revalidate: 300 } });
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
  const source = await fetchAgendaFile(ref, filePath, contentType);

  if (!source.ok) {
    return NextResponse.json(
      { error: "O Agendamento do Motorista não pôde ser carregado." },
      { status: 502 },
    );
  }

  if (filePath === "index.html") {
    const html = (await source.text()).replace("</head>", '<base href="/agenda-motorista/"></head>');
    return new NextResponse(html, {
      headers: { "Content-Type": contentType, "Cache-Control": "no-store, max-age=0" },
    });
  }

  return new NextResponse(await source.arrayBuffer(), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
