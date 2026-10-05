# Convite de 15 anos - GitHub Pages

A versão publicada fica em `docs/`. Ela é estática e usa Google Sheets + Apps Script para receber as confirmações e alimentar a lista pública. Os arquivos PHP da versão XAMPP e o CSV local ficam fora do repositório pelo `.gitignore`.

## Preparar a planilha

1. Crie uma planilha Google nova. Não é necessário compartilhar a planilha com o público.
2. Abra **Extensões > Apps Script**.
3. Substitua o conteúdo de `Code.gs` pelo arquivo `apps-script/Code.gs` deste projeto e salve.
4. Em **Configurações do projeto > Propriedades do script**, adicione `SPREADSHEET_ID`. O valor é o identificador entre `/d/` e `/edit` no endereço da planilha.
5. Em **Configurações do projeto**, escolha o fuso horário `America/Sao_Paulo`.
6. Clique em **Implantar > Nova implantação**, escolha **App da Web**, configure **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**, depois implante e autorize o acesso à planilha.
7. Copie a URL terminada em `/exec` da implantação.

A planilha permanece privada. O endpoint de leitura do Apps Script retorna publicamente nome, resposta de presença, acompanhantes e horário da confirmação, pois a página de lista foi solicitada como pública. Não coloque dados sensíveis nessa planilha.

## Conectar o site

Edite `docs/config.js` e substitua `COLE_AQUI_A_URL_PUBLICADA_DO_APPS_SCRIPT` pela URL `/exec` copiada no passo anterior, mantendo as aspas. Faça um teste de confirmação e confira `docs/lista.html`.

## Publicar no GitHub Pages

1. Crie um repositório GitHub separado, somente para esta pasta `aniversario`; não use `htdocs` como repositório.
2. Confira se `/index.php`, `/lista.php` e `/dados/` aparecem ignorados. O `.gitignore` exclui os arquivos da instalação XAMPP e qualquer CSV. Nunca force esses arquivos para o repositório.
3. Envie para o GitHub os arquivos rastreados da pasta `aniversario`.
4. No repositório, abra **Settings > Pages**. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main` e pasta `/docs`, depois salve.
5. O GitHub mostrará o endereço do site. O convite ficará em `/` e a lista em `/lista.html`.

O repositório pode ser público para usar o GitHub Pages no plano gratuito. Não inclua arquivos de convidados, exportações da planilha ou tokens. A URL do Apps Script é pública por natureza e não deve ser tratada como senha.

## Arquivos

- `docs/`: páginas, estilos e scripts publicados pelo GitHub Pages.
- `apps-script/Code.gs`: backend executado pelo Google Apps Script; deve ser copiado para o projeto Apps Script, não publicado como página.
- `index.php`, `lista.php` e `dados/`: versão local do XAMPP, ignorada pelo Git.
