import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canonical(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function columnLetterToIndex(value: string) {
  const text = value.trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(text)) return null;
  let number = 0;
  for (const char of text) number = number * 26 + char.charCodeAt(0) - 64;
  return number - 1;
}

function resolveColumn(header: unknown[], specification: string) {
  const byLetter = columnLetterToIndex(specification);
  if (byLetter !== null) return byLetter;
  const wanted = canonical(specification);
  if (!wanted) return null;
  let exact: number | null = null;
  let partial: number | null = null;
  header.forEach((cell, index) => {
    const current = canonical(cell);
    if (current === wanted && exact === null) exact = index;
    else if (
      current &&
      (current.includes(wanted) || wanted.includes(current)) &&
      partial === null
    ) {
      partial = index;
    }
  });
  return exact ?? partial;
}

function locateHeader(
  rows: unknown[][],
  mapping: { codigo: string; descricao: string; quantidade: string },
) {
  const specs = [mapping.codigo, mapping.descricao, mapping.quantidade];
  const allLetters = specs.every((spec) => columnLetterToIndex(spec) !== null);
  if (allLetters) {
    return {
      headerIndex: rows[2] ? 2 : 0,
      codeIndex: columnLetterToIndex(mapping.codigo)!,
      descriptionIndex: columnLetterToIndex(mapping.descricao)!,
      quantityIndex: columnLetterToIndex(mapping.quantidade)!,
    };
  }

  const order = rows[2] ? [2] : [];
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    if (index !== 2) order.push(index);
  }

  for (const headerIndex of order) {
    const header = rows[headerIndex] || [];
    const codeIndex = resolveColumn(header, mapping.codigo);
    const descriptionIndex = resolveColumn(header, mapping.descricao);
    const quantityIndex = resolveColumn(header, mapping.quantidade);
    if (
      codeIndex !== null &&
      descriptionIndex !== null &&
      quantityIndex !== null &&
      new Set([codeIndex, descriptionIndex, quantityIndex]).size === 3
    ) {
      return { headerIndex, codeIndex, descriptionIndex, quantityIndex };
    }
  }
  return null;
}

function spreadsheetIdentity(value: string) {
  const url = new URL(value);
  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !match) {
    throw new Error("Cole um link válido do Google Sheets.");
  }
  const hashGid = (url.hash.match(/gid=(\d+)/) || [])[1];
  const gidText = url.searchParams.get("gid") || hashGid;
  return {
    spreadsheetId: match[1],
    gid: gidText ? Number(gidText) : null,
  };
}

function escapeSheetTitle(value: string) {
  return value.replace(/'/g, "''");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente no Portal." },
      { status: 401 },
    );
  }
  if (!hasModuleAccess(session.user.email, "compras")) {
    return NextResponse.json(
      { error: "Acesso não autorizado ao módulo Compras." },
      { status: 403 },
    );
  }
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Sessão Google expirada. Saia e entre novamente no Portal." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      url?: string;
      codigo?: string;
      descricao?: string;
      quantidade?: string;
    };
    const url = body.url?.trim() || "";
    const mapping = {
      codigo: body.codigo?.trim() || "",
      descricao: body.descricao?.trim() || "",
      quantidade: body.quantidade?.trim() || "",
    };
    if (!url || !mapping.codigo || !mapping.descricao || !mapping.quantidade) {
      throw new Error("Informe o link e as três colunas da planilha.");
    }

    const { spreadsheetId, gid } = spreadsheetIdentity(url);
    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth });
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties(sheetId,title,index,hidden)",
    });
    const availableSheets = (metadata.data.sheets || []).filter(
      (sheet) => !sheet.properties?.hidden,
    );
    const target =
      (gid !== null
        ? availableSheets.find((sheet) => sheet.properties?.sheetId === gid)
        : null) || availableSheets[0];
    const title = target?.properties?.title;
    if (!title) throw new Error("Não foi possível identificar a aba da planilha.");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${escapeSheetTitle(title)}'!A:ZZ`,
      majorDimension: "ROWS",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (response.data.values || []) as unknown[][];
    if (rows.length < 2) throw new Error("A planilha não possui linhas suficientes.");

    const columns = locateHeader(rows, mapping);
    if (!columns) {
      throw new Error(
        "Não encontrei as três colunas informadas. Use o nome exato do cabeçalho ou a letra da coluna.",
      );
    }

    const items = rows
      .slice(columns.headerIndex + 1)
      .map((row) => ({
        codigo: String(row[columns.codeIndex] ?? "").trim(),
        descricao: String(row[columns.descriptionIndex] ?? "").trim(),
        quantidade: String(row[columns.quantityIndex] ?? "").trim(),
      }))
      .filter((item) => item.codigo && item.descricao && item.quantidade);

    if (!items.length) {
      throw new Error("Nenhum item com código, descrição e quantidade foi encontrado.");
    }

    return NextResponse.json({
      ok: true,
      spreadsheetTitle: metadata.data.properties?.title || "Planilha",
      sheetTitle: title,
      quantityHeader: String(rows[columns.headerIndex]?.[columns.quantityIndex] ?? mapping.quantidade),
      totalItems: items.length,
      items,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível extrair a planilha.";
    const needsConsent = /insufficient|permission|scope|forbidden|403/i.test(message);
    return NextResponse.json(
      {
        error: needsConsent
          ? "Autorize o acesso às planilhas: saia do Portal e entre novamente."
          : message,
      },
      { status: needsConsent ? 403 : 400 },
    );
  }
}
