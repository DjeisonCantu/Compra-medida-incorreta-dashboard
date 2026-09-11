const COLORS = {
  accent: "#480088",
  accentSoft: "#8a5cc4",
  danger: "#D64541",
  warning: "#E9A23B",
  success: "#34A853",
  neutral: "#8E8E93",
};

const LEITURA_ORDER = ["Alta", "Média", "Baixa", "A investigar"];

function badgeClassFor(value) {
  if (!value) return "badge-neutro";
  const v = value.toLowerCase();
  if (v === "alta" || v === "alto" || v === "confirmada") return "badge-alta";
  if (v === "média" || v === "medio" || v === "médio") return "badge-media";
  if (v === "baixa" || v === "baixo") return "badge-baixa";
  if (v === "a investigar") return "badge-investigar";
  return "badge-neutro";
}

function badge(value, extraClass) {
  if (!value) return "";
  const cls = extraClass || badgeClassFor(value);
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${escapeHtml(value)}</span>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] || "Sem valor";
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function renderKpis(data) {
  const evidenciasAtivas = data.evidencias.filter((e) => e.status !== "Arquivado");
  const causasConfirmadas = data.causas.filter((c) => c.status === "Confirmada").length;
  const fontesAnalisadas = data.fontes.filter((f) => f.statusAnalise === "Analisado").length;
  const pctFontesAnalisadas = data.fontes.length
    ? Math.round((fontesAnalisadas / data.fontes.length) * 100)
    : 0;
  const frentesConcluidas = data.frentes.filter((f) => f.status === "Concluído").length;

  const kpis = [
    { value: evidenciasAtivas.length, label: "Evidências ativas" },
    { value: causasConfirmadas, label: "Causas confirmadas" },
    { value: `${pctFontesAnalisadas}%`, label: "Fontes analisadas" },
    { value: frentesConcluidas, label: "Frentes concluídas" },
  ];

  document.getElementById("kpi-row").innerHTML = kpis
    .map(
      (k) => `
      <div class="kpi-card">
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
      </div>`
    )
    .join("");
}

function renderCausas(data) {
  const el = document.getElementById("causas-grid");
  if (!data.causas.length) {
    el.innerHTML = emptyState("Nenhuma causa cadastrada ainda no Notion.");
    return;
  }

  const sorted = [...data.causas].sort((a, b) => {
    const orderA = LEITURA_ORDER.indexOf(a.leitura);
    const orderB = LEITURA_ORDER.indexOf(b.leitura);
    const rankA = orderA === -1 ? LEITURA_ORDER.length : orderA;
    const rankB = orderB === -1 ? LEITURA_ORDER.length : orderB;
    if (rankA !== rankB) return rankA - rankB;
    return (b.nEvidencias || 0) - (a.nEvidencias || 0);
  });

  el.innerHTML = sorted
    .map(
      (c) => `
      <div class="causa-card">
        <div class="causa-card-top">
          <div class="causa-nome">${escapeHtml(c.causa || "Sem nome")}</div>
        </div>
        ${c.descricao ? `<p class="causa-desc">${escapeHtml(c.descricao)}</p>` : ""}
        <div class="causa-meta">
          ${badge(c.leitura)}
          ${badge(c.status, "badge-accent")}
        </div>
        <div class="causa-n"><strong>${c.nEvidencias || 0}</strong> evidência(s)</div>
      </div>`
    )
    .join("");
}

function makeBarChart(canvasId, labelsToValues, colorMap) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = Object.keys(labelsToValues);
  if (!labels.length) {
    ctx.parentElement.innerHTML += emptyState("Sem dados.");
    return;
  }
  const values = labels.map((l) => labelsToValues[l]);
  const colors = labels.map((l) => (colorMap && colorMap[l]) || COLORS.accentSoft);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderRadius: 8, maxBarThickness: 40 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#e5e5ea" } },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderEvidencias(data) {
  const ativas = data.evidencias.filter((e) => e.status !== "Arquivado");

  makeBarChart("chart-tipo", countBy(ativas, "tipo"));
  makeBarChart("chart-forca", countBy(ativas, "forca"));
  makeBarChart("chart-frequencia", countBy(ativas, "frequencia"), {
    Alta: COLORS.danger,
    Média: COLORS.warning,
    Baixa: COLORS.success,
  });
  makeBarChart("chart-impacto", countBy(ativas, "impacto"), {
    Alto: COLORS.danger,
    Médio: COLORS.warning,
    Baixo: COLORS.success,
  });

  const destaque = ativas.filter(
    (e) => e.forca === "Caso concreto" || e.forca === "Dado quantitativo"
  ).filter((e) => e.impacto === "Alto");

  const el = document.getElementById("evidencias-destaque");
  if (!destaque.length) {
    el.innerHTML = emptyState("Nenhuma evidência com força alta + impacto alto no momento.");
    return;
  }

  el.innerHTML = destaque
    .map(
      (e) => `
      <div class="evidencia-item">
        <div class="evidencia-item-top">
          <div>
            <div class="evidencia-titulo">${escapeHtml(e.achado || "Sem título")}</div>
            ${e.evidencia ? `<p class="evidencia-texto">${escapeHtml(e.evidencia)}</p>` : ""}
          </div>
          <div class="evidencia-badges">
            ${badge(e.forca, "badge-accent")}
            ${badge(e.impacto)}
          </div>
        </div>
      </div>`
    )
    .join("");
}

function renderFrentes(data) {
  const el = document.getElementById("frentes-grupos");
  if (!data.frentes.length) {
    el.innerHTML = emptyState("Nenhuma frente cadastrada ainda no Notion.");
    return;
  }

  const grupos = {};
  for (const f of data.frentes) {
    const g = f.grupo || "Sem grupo";
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(f);
  }

  const grupoOrder = ["A — Entender interno", "B — Reaproveitar", "C — Pesquisa usuário", "D — Solução UX", "E — Medir"];
  const grupoNames = Object.keys(grupos).sort((a, b) => {
    const ra = grupoOrder.indexOf(a);
    const rb = grupoOrder.indexOf(b);
    return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
  });

  el.innerHTML = grupoNames
    .map((g) => {
      const items = grupos[g];
      const concluidas = items.filter((f) => f.status === "Concluído").length;
      const pct = items.length ? Math.round((concluidas / items.length) * 100) : 0;

      const linhas = items
        .map(
          (f) => `
          <div class="frente-linha">
            <div>
              <div class="frente-nome">${escapeHtml(f.frente || "Sem nome")}</div>
              ${f.proximoPasso ? `<p class="frente-proximo">${escapeHtml(f.proximoPasso)}</p>` : ""}
            </div>
            <div class="frente-badges">
              ${badge(f.prioridade)}
              ${badge(f.status, "badge-accent")}
            </div>
          </div>`
        )
        .join("");

      return `
        <div class="grupo-block">
          <div class="grupo-header">
            <div class="grupo-nome">${escapeHtml(g)}</div>
            <div class="causa-n"><strong>${concluidas}/${items.length}</strong> concluídas</div>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          ${linhas}
        </div>`;
    })
    .join("");
}

function renderFontes(data) {
  const statusCounts = countBy(data.fontes, "statusAnalise");
  makeBarChart("chart-fontes-status", statusCounts, {
    Analisado: COLORS.success,
    "Em análise": COLORS.warning,
    "A analisar": COLORS.neutral,
  });

  const ranking = [...data.fontes]
    .sort((a, b) => (b.evidenciasGeradasIds?.length || 0) - (a.evidenciasGeradasIds?.length || 0))
    .filter((f) => (f.evidenciasGeradasIds?.length || 0) > 0);

  const el = document.getElementById("fontes-ranking-list");
  if (!ranking.length) {
    el.parentElement.innerHTML = `<h3>Ranking por evidências geradas</h3>${emptyState(
      "Nenhuma fonte com evidências vinculadas ainda."
    )}`;
    return;
  }

  el.innerHTML = ranking
    .map(
      (f) =>
        `<li>${escapeHtml(f.fonte || "Sem nome")} — <span class="ranking-count">${f.evidenciasGeradasIds.length}</span></li>`
    )
    .join("");
}

async function main() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    document.getElementById("updated-at").textContent = `Atualizado em: ${data.generatedAtLabel}`;

    renderKpis(data);
    renderCausas(data);
    renderEvidencias(data);
    renderFrentes(data);
    renderFontes(data);
  } catch (err) {
    console.error(err);
    document.getElementById("updated-at").textContent = "Não foi possível carregar os dados.";
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.innerHTML = "";
    });
  }
}

main();
