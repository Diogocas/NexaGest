# NexaGest 9.3.0 — Publicação Automática

Esta versão adiciona o script `PUBLICAR.bat` para copiar automaticamente os arquivos do projeto principal para a pasta `NexaGest-GitHub`, fazer commit e enviar para o GitHub.

## Fluxo recomendado

1. Desenvolva e teste no projeto principal.
2. Gere o instalador quando estiver pronto.
3. Execute `PUBLICAR.bat` no projeto principal.
4. Confirme o commit e o push.
5. No GitHub, crie uma Release com a tag da versão.
6. Anexe apenas:
   - `NexaGest-Setup.exe`
   - `latest.yml`
   - `NexaGest-Setup.exe.blockmap`

## Importante

A pasta `dist/` e `node_modules/` não devem ir para o repositório. O instalador vai apenas na aba Releases.

## Atualizador PRO

A janela padrão do Windows só aparece em versões antigas. A partir da versão com Atualizador PRO, as próximas atualizações aparecem em um modal interno do NexaGest, com progresso e botão para reiniciar/instalar.
