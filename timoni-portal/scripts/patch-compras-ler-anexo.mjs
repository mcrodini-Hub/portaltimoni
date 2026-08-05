import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function patch(relativePath, transform) {
  const filePath = resolve(root, relativePath);
  const source = readFileSync(filePath, "utf8");
  const next = transform(source);
  writeFileSync(filePath, next, "utf8");
}

patch("app/api/compras/ler-print/route.ts", (source) => {
  return source
    .replace(
      'const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);\nconst MAX_BYTES = 8 * 1024 * 1024;',
      'const ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);\nconst MAX_BYTES = 10 * 1024 * 1024;',
    )
    .replace('const image = formData.get("print");', 'const documentFile = formData.get("print");')
    .replaceAll('image instanceof File', 'documentFile instanceof File')
    .replaceAll('image.size', 'documentFile.size')
    .replaceAll('image.type', 'documentFile.type')
    .replaceAll('image.arrayBuffer()', 'documentFile.arrayBuffer()')
    .replace('Cole ou selecione o print do pedido.', 'Anexe o PDF ou cole um print do pedido.')
    .replace('Use um print PNG, JPG ou WEBP.', 'Use PDF, PNG, JPG ou WEBP.')
    .replace('O print ultrapassa 8 MB. Faça uma captura menor.', 'O arquivo ultrapassa 10 MB.')
    .replace('Leia este print de um pedido de compra da Casa Timoni.', 'Leia este pedido de compra da Casa Timoni. O arquivo pode ser PDF ou imagem.');
});

patch("app/dashboard/compras/ComprasClient.tsx", (source) => {
  let next = source;

  next = next
    .replace('const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";', 'const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras?filter=label:Rio%20Claro,label:Urgente,label:Pendente";')
    .replace('useState("A")', 'useState("B")')
    .replace('useState("B")', 'useState("C")')
    .replace('useState("AB")', 'useState("L")');

  next = next.replace(
    /<div className="mt-4 grid gap-3 sm:grid-cols-3">[\s\S]*?<\/div>\n\s*<button type="button" onClick=\{\(\) => void extractItems\(\)\}/,
    '<div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><strong>Colunas fixas:</strong> Código = B · Descrição = C · Quantidade = L</div>\n          <button type="button" onClick={() => void extractItems()}',
  );

  next = next
    .replace('Colar print e anexar arquivo', 'Ler pedido em PDF ou print')
    .replace('Cole o print com <strong>Ctrl+V</strong>. O Portal lê o número do pedido, a empresa e as datas para preencher o cartão; o print também será anexado ao Trello.', 'Anexe o pedido em PDF ou cole um print com <strong>Ctrl+V</strong>. O arquivo é usado somente para leitura; nada é anexado ao Trello.')
    .replace('Opcional. Anexe o PDF ou a imagem original do pedido ao mesmo cartão.', 'Anexe o pedido em PDF, PNG, JPG ou WEBP para preencher título e datas automaticamente.')
    .replace('Selecionar arquivo', 'Selecionar pedido')
    .replace('O Portal grava os itens, anexa o print e o arquivo, aplica a etiqueta Enviado e move o cartão para o topo da lista correta.', 'O Portal grava os itens, aplica a etiqueta Enviado e move o cartão para o topo da lista correta.')
    .replace('A conexão substitui a extensão e permite ler, atualizar, anexar e mover os cartões pelo Portal.', 'A conexão substitui a extensão e permite ler, atualizar e mover os cartões pelo Portal.');

  next = next.replace(
    '    setOrderFile(file);\n    setSuccess("Arquivo do pedido pronto para ser anexado ao cartão.");',
    '    setOrderFile(file);\n    void readOrderPrint(file);',
  );

  next = next.replace(
    '    if (!orderPrint) {\n      setError("Cole o print do pedido feito antes de atualizar o Trello.");\n      return;\n    }',
    '    if (!orderPrint && !orderFile) {\n      setError("Anexe o PDF ou cole o print do pedido antes de atualizar o Trello.");\n      return;\n    }',
  );

  next = next
    .replace('      formData.set("attachment", orderPrint, orderPrint.name);\n      if (orderFile) formData.set("orderFile", orderFile, orderFile.name);\n', '')
    .replace('disabled={busy || readingPrint || !selectedSupplier || !items.length || !orderPrint}', 'disabled={busy || readingPrint || !selectedSupplier || !items.length || (!orderPrint && !orderFile)}')
    .replace('readingPrint ? "Lendo print..."', 'readingPrint ? "Lendo pedido..."');

  next = next.replace(
    /\s*const attachments = \[[\s\S]*?setSuccess\([\s\S]*?\);\n\s*setUpdatedCardUrl/,
    '\n      setSuccess("Pronto!");\n      setUpdatedCardUrl',
  );

  next = next.replace(
    /\n\s*async function copySupplierMessage\(\) \{[\s\S]*?\n\s*\}\n\n\s*const summary/,
    '\n\n  const summary',
  );

  next = next.replace(
    /\n\s*<section className="rounded-3xl border border-blue-200 bg-blue-50 p-6">[\s\S]*?Mensagem para o fornecedor[\s\S]*?<\/section>/,
    '',
  );

  return next;
});

console.log("Compras simplificado: colunas B/C/L, leitura por PDF ou print, sem WhatsApp e sem anexos no Trello.");
