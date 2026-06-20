# Setlist — Atualizador de Repertório (PWA)

PWA para músicos: cole a lista numerada do repertório de um show, salve num
banco de dados (Google Sheets) e gere o PDF para ler ao vivo no palco.

---

## Como o processo foi repensado

**Fluxo original que você descreveu:** colar a lista → salvar numa planilha →
exportar PDF. Funcional, mas com três problemas que o app abaixo resolve:

| Problema no fluxo original | Solução aplicada |
|---|---|
| Planilha guardaria a lista como **um bloco de texto por show** — impossível pesquisar "em quantos shows toquei a música X". | Cada música vira **uma linha** na planilha (`Data, Local, Ordem, Música`). Isso transforma a planilha num banco de dados pesquisável de verdade, que é exatamente o que você pediu ("banco de consultas de música"). |
| PDF dependeria de internet/Apps Script no momento do show. | A geração do PDF é **100% local no navegador** (jsPDF) e **não depende do salvamento na planilha ter funcionado**. Se a internet cair no dia do show, você ainda baixa o PDF normalmente. |
| Sem forma de consultar o histórico depois. | Duas abas novas: **Buscar** (pesquisa uma música em todos os shows já salvos) e **Histórico** (lista todos os shows registrados). |
| Apps Script Web Apps têm um problema clássico de CORS com `POST` + `application/json` (o preflight `OPTIONS` não é respondido corretamente). | O `fetch` envia o corpo como `text/plain` — formato "simples" que o navegador não bloqueia com preflight — e o `Code.gs` faz o parse do JSON manualmente. |
| Colar a URL/token do Apps Script direto no código fonte deixaria a credencial exposta no GitHub público. | URL e token ficam só no **localStorage do seu celular/computador**, configurados uma vez na tela de engrenagem (⚙) do app. O repositório no GitHub fica 100% genérico, sem nenhum segredo. |

### Estrutura de dados na planilha

```
Aba "Repertorio"          Aba "Shows"
Timestamp | Data | Local | Ordem | Música     Timestamp | Data | Local | Qtd Músicas
...                                            ...
```

Uma linha por música permite filtrar, usar tabela dinâmica, ou simplesmente
`Ctrl+F` na planilha — além da busca já pronta dentro do próprio app.

---

## Estrutura do projeto

```
repertorio-pwa/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── sw.js
├── vercel.json
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-192-maskable.png
│   └── icon-512-maskable.png
└── google-apps-script/
    └── Code.gs            ← não vai pro Vercel, vai pro Apps Script
```

---

## Passo 1 — Backend (Google Apps Script)

1. Crie uma planilha nova em [sheets.google.com](https://sheets.google.com) (pode deixá-la em branco — as abas `Repertorio` e `Shows` são criadas sozinhas no primeiro salvamento).
2. **Extensões → Apps Script**.
3. Apague o conteúdo padrão e cole o conteúdo de `google-apps-script/Code.gs`.
4. Troque a linha:
   ```js
   const SECRET_TOKEN = 'TROQUE_ESTE_TOKEN';
   ```
   por uma senha só sua (qualquer texto, ex: `fb-2026-xK9`).
5. **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Autorize as permissões pedidas (é o seu próprio script acessando sua própria planilha).
7. Copie a URL gerada (termina em `/exec`). Você vai usá-la no passo 4.

> Sempre que editar o `Code.gs`, é preciso fazer **Implantar → Gerenciar implantações → ✎ → Nova versão** para as mudanças valerem na URL publicada.

---

## Passo 2 — Subir no GitHub

```bash
cd repertorio-pwa
git init
git add .
git commit -m "Setlist PWA — atualizador de repertório"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/repertorio-pwa.git
git push -u origin main
```

(Crie o repositório vazio antes em github.com/new — sem README/license, pra não dar conflito.)

---

## Passo 3 — Publicar no Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project**.
2. Importe o repositório `repertorio-pwa` do GitHub.
3. Framework Preset: **Other** (é um site estático puro, sem build step).
4. Build Command: deixe vazio. Output Directory: deixe vazio / raiz.
5. **Deploy**.

Em ~30 segundos você tem uma URL tipo `https://repertorio-pwa.vercel.app`.

---

## Passo 4 — Conectar o app à planilha

1. Abra a URL do Vercel no celular.
2. Toque no ícone de engrenagem (⚙) no topo.
3. Cole a **URL do Apps Script** (passo 1.7) e o **token** que você definiu.
4. **Salvar conexão**.
5. (Opcional) No menu do navegador, **Adicionar à tela inicial** — vira um app de verdade, com ícone próprio.

---

## Uso no dia a dia

1. **Registrar**: preencha local e data do show, cole a lista numerada recebida, confira a pré-visualização e toque em **Atualizar repertório** — isso grava cada música na planilha.
2. Toque em **Baixar PDF** (ou **Imprimir**) para gerar o setlist daquele show pronto pra abrir no palco — funciona mesmo sem internet, pois é gerado no próprio navegador.
3. **Buscar**: digite o nome de uma música pra ver em quais shows e datas ela já foi tocada.
4. **Histórico**: lista de todos os shows já registrados, do mais recente pro mais antigo.

---

## Limitações conhecidas

- Por ser um app estático conversando direto com Apps Script, o token fica visível no `localStorage` do dispositivo (não no código-fonte) — suficiente pra uso pessoal, mas não é um sistema de autenticação robusto. Não use para dados sensíveis.
- O parser de lista aceita os formatos mais comuns (`1.`, `1)`, `1 -`, `-`, `*`, `•`); listas com numeração muito incomum podem precisar de um ajuste manual antes de colar.
