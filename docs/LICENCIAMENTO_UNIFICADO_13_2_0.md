# NexaGest 13.2.0 — Motor de Licenciamento Unificado

Esta versão corrige e unifica o formato de licença offline usado pelo NexaGest e pelo NexaGest License Manager DEV.

## Correções

- Licenças geradas no License Manager DEV agora são aceitas corretamente no NexaGest.
- O payload da licença não é mais convertido para maiúsculas durante a validação.
- Licenças por período e permanentes usam o mesmo formato oficial.
- Licenças de teste rápido por minutos continuam disponíveis para validação do bloqueio.
- O teste automático de 8 dias permanece ativo no primeiro uso.
- A versão foi atualizada para 13.2.0.

## Modelo atual

O NexaGest trabalha com dois tipos de licença:

- Por período: começa a contar na primeira ativação.
- Permanente: não expira.

Não existem mais planos Essencial/Profissional nem licença DEMO como plano separado.
