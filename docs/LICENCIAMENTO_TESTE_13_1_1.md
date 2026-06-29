# NexaGest 13.1.1 — Teste de licença

Esta versão ajusta o trial automático para 8 dias e adiciona suporte a licença de teste rápido por minutos no License Manager DEV.

## Trial automático
- Primeiro uso cria licença automática de 8 dias.
- Avisos aparecem quando faltam 3 dias ou menos.
- O sistema verifica a licença periodicamente enquanto está aberto.
- Ao expirar, o sistema bloqueia e mantém apenas a ativação disponível.

## Teste rápido DEV
No arquivo `tools/NexaGest-License-Manager-DEV.html`, use o campo **Teste rápido (minutos)** para gerar uma licença que expira em poucos minutos.

Esse recurso é apenas para validar bloqueio, aviso e reativação sem esperar dias.
