// Build script: lê as 4 databases do Notion e gera public/data.json + timestamp de build.
// Nunca expõe o NOTION_TOKEN fora deste processo (server-side, roda só no GitHub Actions / localmente).
import { Client } from "@notionhq/client";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const DATABASES = {
  causas: "ae328748-c572-4f97-91bd-b1bcc40bc9f8",
  evidencias: "3ee5721d-204c-4e51-94be-2fe939bda5c6",
  fontes: "232e80a4-cc9f-4a75-b58a-d90fb36f4661",
  frentes: "c38b1a79-f6e8-4cea-ab08-f0b942bee161",
};

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error(
    "NOTION_TOKEN não definido. Defina a variável de ambiente (ou o GitHub Secret) antes de rodar o build."
  );
  process.exit(1);
}

const notion = new Client({ auth: token });

// ---- Helpers para ler properties de forma tolerante ----
// Normaliza nomes de coluna (sem acento, minúsculo, sem espaço extra) para casar
// mesmo que o nome exato no Notion mude um pouco.
function normalizeKey(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function buildPropIndex(properties) {
  const index = new Map();
  for (const name of Object.keys(properties)) {
    index.set(normalizeKey(name), name);
  }
  return index;
}

// Retorna a property de `page.properties` cujo nome bate com o primeiro candidato
// encontrado em `candidates` (ordem de preferência). Se nenhum bater, retorna undefined
// em vez de quebrar o build.
function getProp(page, propIndex, candidates) {
  for (const candidate of candidates) {
    const realName = propIndex.get(normalizeKey(candidate));
    if (realName && page.properties[realName] !== undefined) {
      return page.properties[realName];
    }
  }
  return undefined;
}

function extractTitle(prop) {
  if (!prop || prop.type !== "title") return null;
  const text = prop.title.map((t) => t.plain_text).join("");
  return text || null;
}

function extractRichText(prop) {
  if (!prop || prop.type !== "rich_text") return null;
  const text = prop.rich_text.map((t) => t.plain_text).join("");
  return text || null;
}

function extractSelect(prop) {
  if (!prop || prop.type !== "select" || !prop.select) return null;
  return prop.select.name;
}

function extractRollupNumber(prop) {
  if (!prop || prop.type !== "rollup") return null;
  if (prop.rollup.type === "number") return prop.rollup.number;
  if (prop.rollup.type === "array") return prop.rollup.array.length;
  return null;
}

function extractRelationIds(prop) {
  if (!prop || prop.type !== "relation") return [];
  return prop.relation.map((r) => r.id);
}

function extractPeople(prop) {
  if (!prop || prop.type !== "people") return [];
  return prop.people.map((p) => p.name || p.id);
}

function extractUrl(prop) {
  if (!prop || prop.type !== "url") return null;
  return prop.url;
}

// ---- Notion fetch ----
async function retrieveSchema(databaseId, label) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const names = Object.keys(db.properties);
  console.log(`[schema] ${label}: ${names.join(", ")}`);
  return db;
}

async function queryAllPages(databaseId) {
  const pages = [];
  let cursor = undefined;
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function main() {
  console.log("Lendo schemas das 4 databases do Notion...");
  await Promise.all([
    retrieveSchema(DATABASES.causas, "Causas / Origens"),
    retrieveSchema(DATABASES.evidencias, "Evidências / Achados"),
    retrieveSchema(DATABASES.fontes, "Fontes / Dados"),
    retrieveSchema(DATABASES.frentes, "Frentes & Backlog"),
  ]);

  console.log("Buscando registros...");
  const [causasPages, evidenciasPages, fontesPages, frentesPages] = await Promise.all([
    queryAllPages(DATABASES.causas),
    queryAllPages(DATABASES.evidencias),
    queryAllPages(DATABASES.fontes),
    queryAllPages(DATABASES.frentes),
  ]);

  const causas = causasPages.map((page) => {
    const idx = buildPropIndex(page.properties);
    return {
      id: page.id,
      causa: extractTitle(getProp(page, idx, ["Causa"])),
      descricao: extractRichText(getProp(page, idx, ["Descrição", "Descricao"])),
      hipotese: extractRichText(getProp(page, idx, ["Hipótese atual", "Hipotese atual"])),
      leitura: extractSelect(getProp(page, idx, ["Leitura do número", "Leitura do numero"])),
      status: extractSelect(getProp(page, idx, ["Status da investigação", "Status da investigacao"])),
      nEvidencias: extractRollupNumber(getProp(page, idx, ["Nº de evidências", "N de evidencias", "Numero de evidencias"])) ?? 0,
    };
  });

  const evidencias = evidenciasPages.map((page) => {
    const idx = buildPropIndex(page.properties);
    return {
      id: page.id,
      achado: extractTitle(getProp(page, idx, ["Achado"])),
      tipo: extractSelect(getProp(page, idx, ["Tipo"])),
      citacao: extractRichText(getProp(page, idx, ["Citação", "Citacao"])),
      evidencia: extractRichText(getProp(page, idx, ["Evidência", "Evidencia"])),
      fonteCanal: extractSelect(getProp(page, idx, ["Fonte / Canal"])),
      forca: extractSelect(getProp(page, idx, ["Força da evidência", "Forca da evidencia"])),
      frequencia: extractSelect(getProp(page, idx, ["Frequência", "Frequencia"])),
      impacto: extractSelect(getProp(page, idx, ["Impacto"])),
      status: extractSelect(getProp(page, idx, ["Status"])),
      causaRaizIds: extractRelationIds(getProp(page, idx, ["Causa-raiz", "Causa raiz"])),
      fonteIds: extractRelationIds(getProp(page, idx, ["Fonte"])),
      frenteIds: extractRelationIds(getProp(page, idx, ["Frente"])),
    };
  });

  const fontes = fontesPages.map((page) => {
    const idx = buildPropIndex(page.properties);
    return {
      id: page.id,
      fonte: extractTitle(getProp(page, idx, ["Fonte"])),
      tipo: extractSelect(getProp(page, idx, ["Tipo"])),
      statusAnalise: extractSelect(getProp(page, idx, ["Status de análise", "Status de analise"])),
      extraido: extractRichText(getProp(page, idx, ["O que já extraímos", "O que ja extraimos"])),
      link: extractUrl(getProp(page, idx, ["Link"])),
      responsavel: extractPeople(getProp(page, idx, ["Responsável", "Responsavel"])),
      evidenciasGeradasIds: extractRelationIds(getProp(page, idx, ["Evidências geradas", "Evidencias geradas"])),
    };
  });

  const frentes = frentesPages.map((page) => {
    const idx = buildPropIndex(page.properties);
    return {
      id: page.id,
      frente: extractTitle(getProp(page, idx, ["Frente"])),
      grupo: extractSelect(getProp(page, idx, ["Grupo"])),
      tipo: extractSelect(getProp(page, idx, ["Tipo"])),
      status: extractSelect(getProp(page, idx, ["Status"])),
      prioridade: extractSelect(getProp(page, idx, ["Prioridade"])),
      responsavel: extractPeople(getProp(page, idx, ["Responsável", "Responsavel"])),
      proximoPasso: extractRichText(getProp(page, idx, ["Próximo passo", "Proximo passo"])),
      causasIds: extractRelationIds(getProp(page, idx, ["Causas"])),
      evidenciasIds: extractRelationIds(getProp(page, idx, ["Evidências", "Evidencias"])),
    };
  });

  const now = new Date();
  const generatedAtLabel =
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(now) + " (Brasília)";

  const data = {
    generatedAt: now.toISOString(),
    generatedAtLabel,
    causas,
    evidencias,
    fontes,
    frentes,
  };

  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(path.join(PUBLIC_DIR, "data.json"), JSON.stringify(data, null, 2), "utf-8");

  console.log(
    `OK: ${causas.length} causas, ${evidencias.length} evidências, ${fontes.length} fontes, ${frentes.length} frentes.`
  );
  console.log(`data.json gerado em ${path.join(PUBLIC_DIR, "data.json")}`);
}

main().catch((err) => {
  console.error("Erro no build:", err);
  process.exit(1);
});
