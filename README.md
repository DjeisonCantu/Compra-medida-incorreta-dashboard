# Compra Medida Errada — Dashboard

Dashboard estático, público e somente leitura do projeto de UX "Compra Medida Errada". Os dados vêm de 4 databases do Notion e são publicados no GitHub Pages.

## Como funciona (modo atual: rotina agendada do Claude)

O workspace do Notion restringe quem pode criar integrações (API key), então o dashboard usa o **conector do Notion do Claude** em vez de um `NOTION_TOKEN`:

1. Uma rotina agendada do Claude (`claude.ai/code/routines`) roda 1x/dia, lê as 4 databases pelo conector do Notion já autorizado, gera `public/data.json` e faz `git commit` + `push` direto para `main`.
2. Esse push dispara o GitHub Actions (`.github/workflows/deploy.yml`), que só publica a pasta `public/` no GitHub Pages — não chama a API do Notion.
3. `public/index.html` + `app.js` só leem o `data.json` já commitado — nenhuma chamada ao Notion acontece no navegador.

Ninguém precisa colar token nenhum no GitHub nesse modo.

## Modo alternativo (se um dia tiver permissão para criar integração no Notion)

Existe um caminho mais simples pronto no repositório, só desativado por falta de permissão:

1. Crie uma integração interna em [notion.com/my-integrations](https://www.notion.com/my-integrations) e compartilhe as 4 databases com ela.
2. Adicione o secret `NOTION_TOKEN` em **Settings → Secrets and variables → Actions** do repositório.
3. Restaure o step de build no `.github/workflows/deploy.yml` chamando `npm run build` (que roda `build/build.mjs`, via `@notionhq/client`) antes do `upload-pages-artifact` — e volte a adicionar `public/data.json` no `.gitignore`, já que nesse modo ele passa a ser gerado no CI, não commitado.
4. Aí sim dá pra usar `schedule:` no workflow para rodar sozinho, sem depender de rotina do Claude.

## Forçar uma atualização manual

- **Dados** (buscar do Notion de novo): peça para o Claude rodar a rotina agora, ou dispare pela UI em `claude.ai/code/routines`.
- **Só o deploy** (republicar o que já está commitado): aba **Actions** do repositório → **Deploy Dashboard** → **Run workflow**, ou:

```bash
gh workflow run deploy.yml
```

## Se você adicionar um campo novo no Notion

1. Descubra o nome exato da property nova (no próprio Notion, ou pedindo pro Claude checar o schema da database).
2. Em `build/build-from-mcp-export.mjs` (usado pela rotina agendada) e em `build/build.mjs` (usado no modo alternativo com `NOTION_TOKEN`), adicione o campo no `.map()` da database correspondente, usando `getField`/`getProp` com o nome novo.
3. Em `public/app.js`, use o novo campo em `data.<database>[i].<campo>` para renderizar onde fizer sentido.

Se você só **renomear** um campo existente (ex.: "Descrição" → "Descricao"), não precisa mudar nada — a leitura já é tolerante a variações de acento/maiúsculas. Se remover um campo, o build não quebra: o valor vira `null`/vazio e a UI já trata isso com estados vazios.

## Rodar localmente

```bash
npm install
npx serve public
```

Isso serve o `public/data.json` que já estiver commitado. Para gerar um novo localmente sem `NOTION_TOKEN`, veja `build/build-from-mcp-export.mjs` (espera os exports em `build/.mcp-export/*.json`).

## Segurança

- Nenhum token do Notion existe neste modo — o acesso é pelo conector já autorizado do Claude, escopado às 4 databases compartilhadas com ele.
- O build é somente leitura: só consulta dados, nunca escreve no Notion.
- Se voltar a usar `NOTION_TOKEN` (modo alternativo), ele deve ficar só em **Settings → Secrets and variables → Actions**, nunca no código.
