// Alternativa ao build.mjs para quando não há NOTION_TOKEN (API oficial) disponível.
// Lê 4 arquivos JSON já exportados via Notion MCP connector (SELECT * de cada data source,
// no formato { results: [...] } retornado pela ferramenta de query SQL do conector) e gera
// o mesmo public/data.json que o build.mjs geraria. Usado pela rotina agendada (ver README).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, ".mcp-export");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function normalizeKey(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function getField(row, candidates) {
  const index = new Map(Object.keys(row).map((k) => [normalizeKey(k), k]));
  for (const candidate of candidates) {
    const realKey = index.get(normalizeKey(candidate));
    if (realKey && row[realKey] !== undefined) return row[realKey];
  }
  return null;
}

function relIds(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadRows(filename) {
  const raw = await readFile(path.join(EXPORT_DIR, filename), "utf-8");
  const parsed = JSON.parse(raw);
  return parsed.results ?? parsed;
}

async function main() {
  const [causasRows, evidenciasRows, fontesRows, frentesRows] = await Promise.all([
    loadRows("causas.json"),
    loadRows("evidencias.json"),
    loadRows("fontes.json"),
    loadRows("frentes.json"),
  ]);

  const causas = causasRows.map((row) => ({
    id: row.id,
    causa: getField(row, ["Causa"]),
    descricao: getField(row, ["Descrição", "Descricao"]),
    hipotese: getField(row, ["Hipótese atual", "Hipotese atual"]),
    leitura: getField(row, ["Leitura do número", "Leitura do numero"]),
    status: getField(row, ["Status da investigação", "Status da investigacao"]),
    nEvidencias: relIds(getField(row, ["Evidências", "Evidencias"])).length,
  }));

  const evidencias = evidenciasRows.map((row) => ({
    id: row.id,
    achado: getField(row, ["Achado"]),
    tipo: getField(row, ["Tipo"]),
    citacao: getField(row, ["Citação", "Citacao"]),
    evidencia: getField(row, ["Evidência", "Evidencia"]),
    fonteCanal: getField(row, ["Fonte / Canal"]),
    forca: getField(row, ["Força da evidência", "Forca da evidencia"]),
    frequencia: getField(row, ["Frequência", "Frequencia"]),
    impacto: getField(row, ["Impacto"]),
    status: getField(row, ["Status"]),
    causaRaizIds: relIds(getField(row, ["Causa-raiz", "Causa raiz"])),
    fonteIds: relIds(getField(row, ["Fonte"])),
    frenteIds: relIds(getField(row, ["Frente"])),
  }));

  const fontes = fontesRows.map((row) => ({
    id: row.id,
    fonte: getField(row, ["Fonte"]),
    tipo: getField(row, ["Tipo"]),
    statusAnalise: getField(row, ["Status de análise", "Status de analise"]),
    extraido: getField(row, ["O que já extraímos", "O que ja extraimos"]),
    link: getField(row, ["Link"]),
    evidenciasGeradasIds: relIds(getField(row, ["Evidências geradas", "Evidencias geradas"])),
  }));

  const frentes = frentesRows.map((row) => ({
    id: row.id,
    frente: getField(row, ["Frente"]),
    grupo: getField(row, ["Grupo"]),
    tipo: getField(row, ["Tipo"]),
    status: getField(row, ["Status"]),
    prioridade: getField(row, ["Prioridade"]),
    proximoPasso: getField(row, ["Próximo passo", "Proximo passo"]),
    causasIds: relIds(getField(row, ["Causas"])),
    evidenciasIds: relIds(getField(row, ["Evidências", "Evidencias"])),
  }));

  const now = new Date();
  const generatedAtLabel =
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(now) + " (Brasília)";

  const data = { generatedAt: now.toISOString(), generatedAtLabel, causas, evidencias, fontes, frentes };

  await writeFile(path.join(PUBLIC_DIR, "data.json"), JSON.stringify(data, null, 2), "utf-8");
  console.log(
    `OK: ${causas.length} causas, ${evidencias.length} evidências, ${fontes.length} fontes, ${frentes.length} frentes.`
  );
}

main().catch((err) => {
  console.error("Erro no build:", err);
  process.exit(1);
});
