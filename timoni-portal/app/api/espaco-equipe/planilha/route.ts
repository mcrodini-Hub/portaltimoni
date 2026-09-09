import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { listTeamMessages } from "@/lib/espaco-equipe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGEMENT_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeCell(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  if (!MANAGEMENT_EMAILS.has(email)) {
    return Response.json({ error: "Acesso exclusivo da gestão." }, { status: 403 });
  }

  try {
    const messages = await listTeamMessages();
    const rows = messages.map((item) => ({
      "Registrada em": formatDate(item.date),
      Mensagem: safeCell(item.message),
      Situação: item.status || "Novo",
      "Observação para pauta": safeCell(item.note || ""),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Registrada em", "Mensagem", "Situação", "Observação para pauta"],
    });
    worksheet["!cols"] = [{ wch: 20 }, { wch: 80 }, { wch: 18 }, { wch: 45 }];
    worksheet["!autofilter"] = { ref: `A1:D${Math.max(1, rows.length + 1)}` };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mensagens anônimas");
    const content = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="espaco-equipe-pauta-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[espaco-equipe][planilha][GET]", error);
    return Response.json({ error: "Não foi possível gerar a planilha." }, { status: 500 });
  }
}
