# Gerar instalador .exe

No Windows, dentro da pasta do projeto:

```powershell
npm install --foreground-scripts
npm run dist:win
```

Resultado esperado:

```text
dist/NexaGest Setup <versão>.exe
```

Observação: o instalador final deve ser testado em um computador limpo antes de entregar ao cliente.
