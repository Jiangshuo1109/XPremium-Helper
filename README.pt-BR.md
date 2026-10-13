# XPremium Helper

[简体中文](README.md) · [English](README.en.md) · [Español](README.es.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

Extensão para Chrome e Edge que coloca ações de seguir, seguir de volta e deixar de seguir abaixo dos avatares do X, após verificar a identidade e a relação entre as contas. Relações mútuas recebem uma etiqueta sem ação. Cada mudança depende do seu clique e usa os controles nativos do X.

**Versão 0.3.0, prévia.** Adiciona respostas rápidas ao lado do editor, modelos locais e um endpoint opcional compatível com OpenAI Chat Completions. O texto gerado apenas entra no rascunho e nunca é enviado automaticamente. A leitura de relações em grupos ainda não foi validada no site real.

[Baixar prévia](https://github.com/Jiangshuo1109/XPremium-Helper/releases) · [Relatar problema](https://github.com/Jiangshuo1109/XPremium-Helper/issues) · [Histórico](CHANGELOG.md)

Mantida por **禁忌の小姜**. [Siga @jiangza9 no X](https://x.com/jiangza9) para acompanhar atualizações. Seguir é opcional e não libera nem limita recursos.

> ⚠️ **Aviso:** Esta é uma extensão independente em versão prévia e não é afiliada à X Corp. Confira cada ação e respeite as regras da plataforma. O projeto não garante a precisão das relações, os resultados no X ou a compatibilidade futura. Leia o [aviso completo](DISCLAIMER.md).

## Recursos E Capturas

As imagens mostram uma versão de prévia em um navegador isolado, com publicações e relações fictícias e o avatar do autor incluído na extensão. Não comprovam operações reais no X. Versões e intervalos mostrados nas imagens podem ser estados simulados, não uma versão publicada ou uma restrição real.

<img src="docs/screenshots/popup.png" alt="Painel XPremium-Helper" width="360">

![Ações nos avatares e relação mútua no tema claro](docs/screenshots/desktop-light.png)

| Recurso | Comportamento |
| --- | --- |
| Seguir e seguir de volta | Exigem selo azul reconhecido e relação conhecida |
| Relação mútua | Etiqueta “蓝朋友” apenas com evidência explícita; não é clicável |
| Deixar de seguir | Disponível quando você segue a conta sem relação mútua confirmada; exige confirmação do alvo |
| Painel de relações | Busca, filtros e progresso da aba do X ativa ao abrir o painel |
| Estatísticas | Nove contagens sem duplicatas: identificadas, seguindo, seguem você, pendentes de seguir de volta, mútuas, explicitamente não seguem de volta, incertas, solicitações enviadas e selo azul; excluem sua conta |
| Atualizações e links | Verificação automática e manual; feed público se a API do GitHub falhar; links para download, autor e repositório |
| Enter para publicar / responder | Envia em um único editor; Shift+Enter insere uma linha; protege composição IME e seleção de menções |
| Leitura e intervalo | Fila de até 20 verificações, cache de um minuto em memória e tratamento de intervalo de 30 minutos por limite de velocidade |
| Layout | Temas claro e escuro e janelas estreitas de desktop; não significa suporte a extensões em celulares |

<details>
<summary>Mais imagens: tema escuro, confirmação, painel e janela estreita</summary>

![Tema escuro](docs/screenshots/desktop-dark.png)
![Confirmação antes de deixar de seguir](docs/screenshots/unfollow-confirm.png)
![Filtro de relações mútuas](docs/screenshots/popup-filtered.png)
![Intervalo ativo simulado](docs/screenshots/popup-cooldown.png)
<img src="docs/screenshots/narrow-light.png" alt="Janela de desktop com 390 pixels" width="390">

</details>

As contagens cobrem apenas contas identificadas nesta página, não todos os seguidores nem ações realizadas. As categorias se sobrepõem e não devem ser somadas. A relação negativa exige evidência explícita; sem ela, permanece incerta. Busca e filtros alteram a lista, não os totais.

## Instalação E Atualização

1. Abra [Releases](https://github.com/Jiangshuo1109/XPremium-Helper/releases), escolha a **Pre-release** mais recente e baixe `xpremium-helper-chrome-<versão>-preview.zip` ou o pacote `edge`. O arquivo automático “Source code” não serve para instalação direta.
2. Extraia em uma pasta permanente. Abra `chrome://extensions` ou `edge://extensions`.
3. Ative o **Modo do desenvolvedor**, escolha **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
4. Resolva os rascunhos não enviados antes de atualizar as abas do X. Ative ou desative a extensão pelo painel.
5. Para atualizar, substitua os arquivos na mesma pasta, recarregue a extensão no gerenciador e atualize o X.

Abrir o painel consulta as versões públicas. Resultados válidos ficam em cache por seis horas e falhas por um minuto; a verificação manual ignora o cache. Novas versões mostram um link de download e falhas mostram o motivo. A instalação continua manual, sem distribuição em lojas. Compare `SHA256SUMS` com `shasum -a 256 <arquivo.zip>` no macOS ou `Get-FileHash <arquivo.zip> -Algorithm SHA256` no PowerShell.

Comece com uma conta de teste. **Quando ativada, a extensão usa Enter para enviar publicações e respostas em um único editor.** Use Shift+Enter para quebrar linha. DMs, sequências com vários editores e publicações agendadas mantêm o comportamento original.

## Limitações E Privacidade

Os botões ficam ocultos quando faltam evidências de identidade, relação ou controles nativos utilizáveis. Há adaptação para início, detalhes, respostas e listas de seguidores e seguindo. Grupos exigem campos explícitos de relação ainda pendentes de validação real; listas e cabeçalhos de DMs estão incompletos. A ausência de “Segue você” não prova que a pessoa não segue você.

O painel fica vinculado à aba ativa ao ser aberto, consulta seu estado a cada dois segundos e permite atualização manual. Reabra-o após trocar de aba. Sem estado disponível, a lista fica vazia. Uma mudança visível não confirma o resultado definitivo no servidor. Não há repetição automática de ações com falha, rolagem automática, seguir / deixar de seguir em massa, curtidas automáticas nem envio de DMs.

Os scripts são injetados apenas em `https://x.com/*`. As permissões incluem `storage` e acesso a `https://api.github.com/*` e `https://github.com/*` para consultar versões públicas, sem credenciais de login nem dados de contas ou relações do X. Sem chave de API, telemetria, permissão de cookies ou servidor próprio. O X recebe as ações dos seus controles. Configurações, espera e cache de versões ficam localmente. O painel lê diretamente a memória da aba; a rota de compatibilidade ainda armazena resumos e tarefas em sessão, mas **recorre ao armazenamento local quando indisponível e pode persistir após reiniciar o navegador**. Consulte [Privacidade](PRIVACY.md) e o [registro de validação em chinês](docs/验证记录.md).

## Desenvolvimento

Requer Node.js 22+, npm e `zip` para empacotar. No Windows, use WSL ou instale um pacote publicado.

```sh
git clone https://github.com/Jiangshuo1109/XPremium-Helper.git
cd XPremium-Helper
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run check:release
npm run package
```

Carregue `dist/chrome` ou `dist/edge`. Pacotes ficam em `release/` e relatórios em `artifacts/`, ambos fora do Git. Capturas públicas ficam em `docs/screenshots/`. Os testes usam páginas fictícias e interceptam a rede. Chromium é obrigatório; Chrome / Edge ausentes ou com falha não são registrados como aprovados.

[Contribuir](CONTRIBUTING.md) · [Segurança](SECURITY.md) · [Aviso](DISCLAIMER.md) · [Publicação](docs/RELEASING.md) · [Próximos passos](docs/ROADMAP.md)

Remova conversas, listas de contas, credenciais e caminhos pessoais dos relatórios. Acompanhe versões por **Watch → Custom → Releases** ou siga [禁忌の小姜 @jiangza9](https://x.com/jiangza9).

## Licença

[MIT](LICENSE). Permite uso, modificação e redistribuição, inclusive comercial, mantendo o aviso de direitos autorais e a licença. Dependências mantêm suas próprias licenças, e as marcas do X pertencem aos respectivos titulares.
