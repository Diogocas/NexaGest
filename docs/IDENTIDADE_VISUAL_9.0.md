# NexaGest 9.0.0 — Identidade Visual Profissional

Esta versão prepara o NexaGest para distribuição comercial com identidade visual padronizada.

## Incluído

- Ícone oficial em `build/icon.ico` para o instalador e executável.
- Ícones PNG em `src/assets/icons/` para uso interno.
- Splash screen em `src/splash.html`.
- Nome fixo do instalador: `NexaGest-Setup.exe`.
- Nome fixo do portátil: `NexaGest-Portable.exe`.
- Estrutura de marca em `src/assets/branding`, `src/assets/splash` e `src/assets/installer`.
- Configuração do `electron-builder` para usar o ícone oficial.

## Gerar instalador

```powershell
npm install --foreground-scripts
npm run dist:win
```

O instalador será gerado em:

```text
dist/NexaGest-Setup.exe
```

A versão continua disponível dentro do aplicativo e nas propriedades do executável.
