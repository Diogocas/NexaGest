# NexaGest 9.2.0 — Infraestrutura de Distribuição

Esta versão consolida a atualização automática via GitHub Releases usando o padrão do electron-updater.

## Requisito importante

Para o aplicativo instalado consultar atualizações sem token, o repositório usado nas Releases precisa ser público.

Recomendado:

- Código-fonte privado, se desejar.
- Repositório público apenas para Releases, ou o próprio repositório NexaGest público.

## Arquivos que devem ir na Release

Anexe somente:

- NexaGest-Setup.exe
- latest.yml
- NexaGest-Setup.exe.blockmap

Não anexe node_modules, dist completa, win-unpacked ou código-fonte como asset manual.

## Como testar atualização

1. Instale uma versão menor, por exemplo 9.1.0.
2. Publique uma Release maior, por exemplo v9.2.0.
3. Anexe os 3 arquivos gerados pelo electron-builder.
4. Abra o app instalado.
5. O NexaGest verifica automaticamente após a abertura e mostra a atualização se o repositório estiver acessível.

## Observação

Se a versão instalada e a versão publicada forem iguais, nenhuma atualização aparece.
