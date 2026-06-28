# NexaGest 9.0.3 — Atualização Automática Profissional

Esta versão padroniza as atualizações pelo `electron-updater`, usando o arquivo `latest.yml` gerado pelo `electron-builder`.

## Fluxo correto

1. Gere o instalador:

```powershell
npm install --foreground-scripts
npm run dist:win
```

2. No GitHub, crie uma Release com a tag da versão, por exemplo:

```txt
v9.0.3
```

3. Anexe na Release:

```txt
NexaGest-Setup.exe
latest.yml
NexaGest-Setup.exe.blockmap
```

4. Publique a Release.

5. No NexaGest, vá em Configurações > Comercialização, licença e atualização e clique em:

```txt
Verificar atualização agora
```

## Observação sobre repositório privado

GitHub Releases privadas exigem autenticação. Para clientes finais, a forma mais simples é usar um repositório público somente para releases ou hospedar os arquivos em um servidor/área de downloads pública.

Não coloque token privado do GitHub dentro do aplicativo distribuído para clientes.
