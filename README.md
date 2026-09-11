# Compra Medida Errada — Dashboard

Dashboard estático, público e somente leitura do projeto de UX "Compra Medida Errada". Os dados vêm de 4 databases do Notion, são normalizados por um build em Node.js e publicados no GitHub Pages. Não escreve nada no Notion e o token de acesso nunca fica exposto no navegador ou no repositório — ele vive só como GitHub Actions Secret.

## Como funciona

1. `build/build.mjs` lê as 4 databases via API do Notion (`@notionhq/client`) e gera `public/data.json`.
2. O GitHub Actions roda esse build automaticamente pelo menos 1x/dia (cron) e também sob demanda.
3. O resultado (`public/`) é publicado no GitHub Pages.
4. `public/index.html` + `app.js` só leem o `data.json` já gerado — nenhuma chamada ao Notion acontece no navegador.

## Trocar o horário do cron

Edite `.github/workflows/deploy.yml`, no bloco `schedule`:

```yaml
schedule:
  - cron: "0 9 * * *" # 09:00 UTC ≈ 06:00 em Brasília
```

O cron do GitHub Actions é sempre em UTC. Exemplos:

- `0 * * * *` → de hora em hora
- `0 12 * * *` → 12:00 UTC (09:00 em Brasília)
- `0 9,21 * * *` → duas vezes por dia

## Forçar uma atualização manual

Na aba **Actions** do repositório, abra o workflow **Build & Deploy Dashboard** → **Run workflow**. Ou, com o `gh` CLI:

```bash
gh workflow run deploy.yml
```

## Se você adicionar um campo novo no Notion

O build já loga os nomes reais das properties de cada database no início da execução (aba Actions → job `build` → step "Build dashboard data"). Para usar um campo novo no dashboard:

1. Rode o build (localmente ou veja o log do Actions) e confira o nome exato da property.
2. Em `build/build.mjs`, adicione o campo dentro do `.map()` da database correspondente, usando `getProp(page, idx, ["Nome do campo"])` com o extractor certo (`extractTitle`, `extractRichText`, `extractSelect`, `extractRelationIds`, `extractPeople`, `extractUrl`, `extractRollupNumber`).
3. Em `public/app.js`, use o novo campo em `data.<database>[i].<campo>` para renderizar onde fizer sentido.

Se você só **renomear** um campo existente (ex.: "Descrição" → "Descricao"), não precisa mudar nada — a leitura já é tolerante a variações de acento/maiúsculas (`normalizeKey`). Se remover um campo, o build não quebra: o valor correspondente vira `null`/vazio e a UI já trata isso com estados vazios.

## Rodar o build localmente

```bash
npm install
NOTION_TOKEN=seu_token_aqui npm run build
```

Isso gera `public/data.json`. Para ver o site localmente, sirva a pasta `public/` com qualquer servidor estático, por exemplo:

```bash
npx serve public
```

## Segurança

- O `NOTION_TOKEN` fica apenas em **Settings → Secrets and variables → Actions** do repositório, nunca no código.
- A integração do Notion tem acesso somente às 4 databases explicitamente compartilhadas com ela.
- O build é `read-only`: só usa `databases.retrieve` e `databases.query`.
