# XPremium Helper

[简体中文](README.md) · [English](README.en.md) · [Español](README.es.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

Extensão para Chrome e Edge que coloca ações de seguir, seguir de volta e deixar de seguir abaixo dos avatares do X, após verificar a identidade e a relação entre as contas. Relações mútuas recebem uma etiqueta sem ação. Cada mudança depende do seu clique e usa os controles nativos do X.

**Versão 0.2.2, prévia.** Não é afiliada à X Corp. e não oferece nem desbloqueia o X Premium. A leitura de relações em grupos ainda não foi validada no site real. A documentação tem cinco idiomas; a interface da extensão é em chinês e reconhece principalmente controles do X em chinês e inglês.

[Baixar prévia](https://github.com/Jiangshuo1109/XPremium-Helper/releases) · [Relatar problema](https://github.com/Jiangshuo1109/XPremium-Helper/issues) · [Histórico](CHANGELOG.md)

Mantida por **禁忌の小姜**. [Siga @jiangza9 no X](https://x.com/jiangza9) para acompanhar atualizações. Seguir é opcional e não libera nem limita recursos.

> ⚠️ **Aviso:** Esta é uma extensão independente em versão prévia e não é afiliada à X Corp. Confira cada ação e respeite as regras da plataforma. O projeto não garante a precisão das relações, os resultados no X ou a compatibilidade futura. Leia o [aviso completo](DISCLAIMER.md).

## Recursos E Capturas

As imagens mostram a extensão real em um navegador isolado, com contas e publicações fictícias. Não comprovam operações concluídas nos servidores do X.

![Ações nos avatares e relação mútua no tema claro](docs/screenshots/desktop-light.png)

| Recurso | Comportamento |
| --- | --- |
| Seguir e seguir de volta | Exigem selo azul reconhecido e relação conhecida |
| Relação mútua | Etiqueta “蓝朋友” apenas com evidência explícita; não é clicável |
| Deixar de seguir | Disponível quando você segue a conta sem relação mútua confirmada; exige confirmação do alvo |
| Painel de relações | Busca de contas, filtros e progresso; o último estado recebido é compartilhado entre abas |
| Enter para publicar / responder | Envia em um único editor; Shift+Enter insere uma linha; protege composição IME e seleção de menções |
| Leitura e intervalo | Fila de até 20 verificações, cache de um minuto em memória e tratamento de intervalo de 30 minutos por limite de velocidade |
| Layout | Temas claro e escuro e janelas estreitas de desktop; não significa suporte a extensões em celulares |

<details>
<summary>Mais imagens: tema escuro, confirmação, painel e janela estreita</summary>

![Tema escuro](docs/screenshots/desktop-dark.png)
![Confirmação antes de deixar de seguir](docs/screenshots/unfollow-confirm.png)
![Painel de relações](docs/screenshots/popup.png)
![Filtro de relações mútuas](docs/screenshots/popup-filtered.png)
<img src="docs/screenshots/narrow-light.png" alt="Janela de desktop com 390 pixels" width="390">

</details>

## Instalação E Atualização

1. Abra [Releases](https://github.com/Jiangshuo1109/XPremium-Helper/releases), escolha a **Pre-release** mais recente e baixe `xpremium-helper-chrome-<versão>-preview.zip` ou o pacote `edge`. O arquivo automático “Source code” não serve para instalação direta.
2. Extraia em uma pasta permanente. Abra `chrome://extensions` ou `edge://extensions`.
3. Ative o **Modo do desenvolvedor**, escolha **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
4. Resolva os rascunhos não enviados antes de atualizar as abas do X. Ative ou desative a extensão pelo painel.
5. Para atualizar, substitua os arquivos na mesma pasta, recarregue a extensão no gerenciador e atualize o X.

Não há distribuição em lojas nem atualização automática. Compare `SHA256SUMS` com `shasum -a 256 <arquivo.zip>` no macOS ou `Get-FileHash <arquivo.zip> -Algorithm SHA256` no PowerShell.

Comece com uma conta de teste. **Quando ativada, a extensão usa Enter para enviar publicações e respostas em um único editor.** Use Shift+Enter para quebrar linha. DMs, sequências com vários editores e publicações agendadas mantêm o comportamento original.

## Limitações E Privacidade

Os botões ficam ocultos quando faltam evidências de identidade, relação ou controles nativos utilizáveis. Há adaptação para início, detalhes, respostas e listas de seguidores e seguindo. Grupos exigem campos explícitos de relação ainda pendentes de validação real; listas e cabeçalhos de DMs estão incompletos. A ausência de “Segue você” não prova que a pessoa não segue você.

O painel pode mostrar registros de outra aba do X. Uma mudança visível não confirma o resultado definitivo no servidor. Não há repetição automática de ações com falha, rolagem automática, seguir / deixar de seguir em massa, curtidas automáticas nem envio de DMs.

Somente a permissão `storage` é solicitada, com scripts apenas em `https://x.com/*`. Sem chave de API, telemetria, permissão de cookies ou servidor próprio. O X recebe as ações enviadas pelos controles nativos. Configurações e prazos de espera ficam no armazenamento local. Resumos e tarefas priorizam o armazenamento de sessão, mas **recorrem ao armazenamento local quando ele está indisponível e podem permanecer após reiniciar o navegador**. Consulte [Privacidade](PRIVACY.md) e o [registro de validação em chinês](docs/验证记录.md).

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
