# NexaGest 13.0.1 — Licenciamento Offline por Período

Esta versão separa a tela do cliente da ferramenta de desenvolvedor.

## No NexaGest instalado

O cliente vê apenas:

- Licença
- Cliente / Responsável
- E-mail da conta
- Plano: Essencial ou Profissional
- Ativar licença
- Verificar atualização

A tela do cliente não possui botão para gerar DEMO, gerar licença, configurar servidor, GitHub ou manifesto.

## No computador do desenvolvedor

Use o arquivo:

`tools/NexaGest-License-Manager-DEV.html`

Nele você gera licenças offline do tipo:

- Demonstração por X dias
- Permanente
- Plano Essencial
- Plano Profissional

Depois copie a licença e envie ao cliente.

## Demonstração de 30 dias

Para teste, gere uma licença do tipo Demonstração com 30 dias. Quando o cliente ativar, o NexaGest exibirá o status de demonstração e a validade.
