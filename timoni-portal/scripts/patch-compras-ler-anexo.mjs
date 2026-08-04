import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function patchFile(relativePath, transformations) {
  const filePath = resolve(root, relativePath);
  let source = readFileSync(filePath, "utf8");

  for (const { search, replacement, label } of transformations) {
    if (source.includes(replacement)) continue;
    if (!source.includes(search)) {
      throw new Error(`Patch ${label} não encontrou o trecho esperado em ${relativePath}.`);
    }
    source = source.replace(search, replacement);
  }

  writeFileSync(filePath, source, "utf8");
}

patchFile("app/api/compras/ler-print/route.ts", [
  {
    label: "tipos aceitos",
    search: 'const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);\nconst MAX_BYTES = 8 * 1024 * 1024;',
    replacement: 'const ALLOWED_TYPES = new Set([\n  "application/pdf",\n  "image/png",\n  "image/jpeg",\n  "image/webp",\n]);\nconst MAX_BYTES = 10 * 1024 * 1024;',
  },
  {
    label: "arquivo genérico",
    search: `    const image = formData.get("print");
    const supplierName = String(formData.get("supplierName") || "").trim();

    if (!(image instanceof File) || image.size === 0) {
      throw new Error("Cole ou selecione o print do pedido.");
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      throw new Error("Use um print PNG, JPG ou WEBP.");
    }
    if (image.size > MAX_BYTES) {
      throw new Error("O print ultrapassa 8 MB. Faça uma captura menor.");
    }`,
    replacement: `    const documentFile = formData.get("print");
    const supplierName = String(formData.get("supplierName") || "").trim();

    if (!(documentFile instanceof File) || documentFile.size === 0) {
      throw new Error("Cole o print ou selecione o arquivo do pedido.");
    }
    if (!ALLOWED_TYPES.has(documentFile.type)) {
      throw new Error("Use PDF, PNG, JPG ou WEBP.");
    }
    if (documentFile.size > MAX_BYTES) {
      throw new Error("O arquivo do pedido ultrapassa 10 MB.");
    }`,
  },
  {
    label: "bytes do arquivo",
    search: "    const bytes = Buffer.from(await image.arrayBuffer());",
    replacement: "    const bytes = Buffer.from(await documentFile.arrayBuffer());",
  },
  {
    label: "prompt do arquivo",
    search: "Leia este print de um pedido de compra da Casa Timoni.",
    replacement: "Leia este arquivo de pedido de compra da Casa Timoni. Ele pode ser PDF ou imagem.",
  },
  {
    label: "mime type do arquivo",
    search: "                    mimeType: image.type,",
    replacement: "                    mimeType: documentFile.type,",
  },
  {
    label: "mensagem sem dados",
    search: '      throw new Error("Não consegui identificar o número ou as datas no print. Faça uma captura mais nítida do cabeçalho.");',
    replacement: '      throw new Error("Não consegui identificar o número ou as datas no arquivo. Use o PDF original ou uma imagem nítida do cabeçalho.");',
  },
]);

patchFile("app/dashboard/compras/ComprasClient.tsx", [
  {
    label: "import useRef",
    search: "  useMemo,\n  useState,",
    replacement: "  useMemo,\n  useRef,\n  useState,",
  },
  {
    label: "normalização de fornecedor",
    search: `function todayLocal() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return \`${'${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}'}\`;
}`,
    replacement: `function todayLocal() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return \`${'${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}'}\`;
}

function normalizeSupplierText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}`,
  },
  {
    label: "preservar documento na seleção automática",
    search: `  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [readingPrint, setReadingPrint] = useState(false);`,
    replacement: `  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [readingPrint, setReadingPrint] = useState(false);
  const preserveDocumentOnNextSupplierChange = useRef(false);`,
  },
  {
    label: "efeito de fornecedor",
    search: `  useEffect(() => {
    if (!selectedSupplier) return;
    setUnit(selectedSupplier.unit === "araras" ? "araras" : "rio_claro");
    setFinalTitle(selectedSupplier.name);
    setItems([]);
    setSheetInfo("");
    setOrderPrint(null);
    setOrderFile(null);
    setDataEntrega("");
    setSuccess("");
    setUpdatedCardUrl("");
  }, [selectedSupplier]);`,
    replacement: `  useEffect(() => {
    if (!selectedSupplier) return;
    setUnit(selectedSupplier.unit === "araras" ? "araras" : "rio_claro");

    if (preserveDocumentOnNextSupplierChange.current) {
      preserveDocumentOnNextSupplierChange.current = false;
      return;
    }

    setFinalTitle(selectedSupplier.name);
    setItems([]);
    setSheetInfo("");
    setOrderPrint(null);
    setOrderFile(null);
    setDataEntrega("");
    setSuccess("");
    setUpdatedCardUrl("");
  }, [selectedSupplier]);`,
  },
  {
    label: "leitura do documento",
    search: `  async function readOrderPrint(file: File) {
    if (!selectedSupplier) return;

    setReadingPrint(true);
    setError("");
    setSuccess("Lendo o número e as datas do pedido...");

    try {
      const formData = new FormData();
      formData.set("print", file, file.name);
      formData.set("supplierName", selectedSupplier.name);

      const response = await fetch("/api/compras/ler-print", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as PrintPayload;
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível ler os dados do print.");
      }

      if (payload.finalTitle) setFinalTitle(payload.finalTitle);
      if (payload.dataEnvio) setDataEnvio(payload.dataEnvio);
      if (payload.dataEntrega) setDataEntrega(payload.dataEntrega);
      setSuccess("Print lido. Confira o título e as datas antes de atualizar o Trello.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? \`${'${caught.message}'} O print continua anexado; preencha os campos manualmente.\`
          : "Não foi possível ler o print. Preencha os campos manualmente.",
      );
      setSuccess("");
    } finally {
      setReadingPrint(false);
    }
  }`,
    replacement: `  async function readOrderDocument(file: File, source: "print" | "arquivo") {
    setReadingPrint(true);
    setError("");
    setSuccess("Lendo o número, a empresa e as datas do pedido...");

    try {
      const formData = new FormData();
      formData.set("print", file, file.name);
      if (selectedSupplier) formData.set("supplierName", selectedSupplier.name);

      const response = await fetch("/api/compras/ler-print", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as PrintPayload;
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível ler os dados do pedido.");
      }

      let resolvedSupplier = selectedSupplier;
      if (!resolvedSupplier && payload.fornecedor) {
        const hint = normalizeSupplierText(payload.fornecedor);
        const match = suppliers.find((supplier) => {
          const name = normalizeSupplierText(supplier.name);
          return Boolean(hint && name && (hint.includes(name) || name.includes(hint)));
        });

        if (match) {
          preserveDocumentOnNextSupplierChange.current = true;
          setSelectedId(match.id);
          resolvedSupplier = match;
          setUnit(match.unit === "araras" ? "araras" : "rio_claro");
        }
      }

      const suffix = \`${'${payload.numeroPedido || ""}${payload.empresa || ""}'}\`;
      const title = [resolvedSupplier?.name || payload.fornecedor || "", suffix]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (title) setFinalTitle(title);
      if (payload.dataEnvio) setDataEnvio(payload.dataEnvio);
      if (payload.dataEntrega) setDataEntrega(payload.dataEntrega);

      if (!resolvedSupplier) {
        setError("Dados lidos, mas o cartão do fornecedor não foi localizado automaticamente. Selecione o fornecedor na etapa 1.");
        setSuccess("");
      } else {
        setSuccess(\`${'${source === "arquivo" ? "Arquivo" : "Print"}'} lido. Confira o título e as datas antes de atualizar o Trello.\`);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? \`${'${caught.message}'} O documento continua anexado; preencha os campos manualmente.\`
          : "Não foi possível ler o documento. Preencha os campos manualmente.",
      );
      setSuccess("");
    } finally {
      setReadingPrint(false);
    }
  }`,
  },
  {
    label: "chamada do print",
    search: "      void readOrderPrint(file);",
    replacement: '      void readOrderDocument(file, "print");',
  },
  {
    label: "leitura do arquivo selecionado",
    search: `    setOrderFile(file);
    setSuccess("Arquivo do pedido pronto para ser anexado ao cartão.");`,
    replacement: `    setOrderFile(file);
    void readOrderDocument(file, "arquivo");`,
  },
  {
    label: "documento obrigatório alternativo",
    search: `    if (!orderPrint) {
      setError("Cole o print do pedido feito antes de atualizar o Trello.");
      return;
    }`,
    replacement: `    if (!orderPrint && !orderFile) {
      setError("Cole o print ou anexe o arquivo do pedido antes de atualizar o Trello.");
      return;
    }`,
  },
  {
    label: "anexo opcional do print",
    search: `      formData.set("items", JSON.stringify(items));
      formData.set("attachment", orderPrint, orderPrint.name);
      if (orderFile) formData.set("orderFile", orderFile, orderFile.name);`,
    replacement: `      formData.set("items", JSON.stringify(items));
      if (orderPrint) formData.set("attachment", orderPrint, orderPrint.name);
      if (orderFile) formData.set("orderFile", orderFile, orderFile.name);`,
  },
  {
    label: "título da etapa",
    search: "Colar print e anexar arquivo",
    replacement: "Colar print ou anexar arquivo",
  },
  {
    label: "explicação da etapa",
    search: "Cole o print com <strong>Ctrl+V</strong>. O Portal lê o número do pedido, a empresa e as datas para preencher o cartão; o print também será anexado ao Trello.",
    replacement: "Cole o print com <strong>Ctrl+V</strong> ou anexe o PDF original. O Portal lê o documento para preencher o cartão e também o anexa ao Trello.",
  },
  {
    label: "arquivo principal",
    search: "Opcional. Anexe o PDF ou a imagem original do pedido ao mesmo cartão.",
    replacement: "O PDF ou a imagem original também pode ser usado para preencher o cartão automaticamente.",
  },
  {
    label: "botão de leitura",
    search: 'disabled={busy || readingPrint || !selectedSupplier || !items.length || !orderPrint}',
    replacement: 'disabled={busy || readingPrint || !selectedSupplier || !items.length || (!orderPrint && !orderFile)}',
  },
  {
    label: "texto do botão",
    search: 'readingPrint ? "Lendo print..."',
    replacement: 'readingPrint ? "Lendo pedido..."',
  },
]);

console.log("Patch do Compras aplicado: o print ou o arquivo do pedido preenche o cartão.");
