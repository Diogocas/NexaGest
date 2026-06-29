# NexaGest 13.1.0 — Trial automático e bloqueio de licença

## Principais ajustes

- Primeiro uso cria automaticamente um teste gratuito de 7 dias.
- Teste gratuito libera o sistema completo durante o período.
- Aviso automático quando faltarem 3 dias ou menos para vencer.
- Verificação automática enquanto o app está aberto.
- Quando vencer, o sistema bloqueia imediatamente e mantém apenas a ativação de licença disponível.
- Os dados cadastrados não são apagados.
- Licença por período ou permanente libera o sistema novamente.
- `PUBLICAR.bat`, `package.json` e `src/config.js` atualizados para `13.1.0`.

## Arquivo DEV

O gerador de licenças continua em:

`tools/NexaGest-License-Manager-DEV.html`

Ele gera licenças por período ou permanentes para ativar o NexaGest após o teste.
