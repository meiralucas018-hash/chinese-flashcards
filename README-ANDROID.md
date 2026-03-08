# Android Build & Google Play Internal Testing

## Pré-requisitos

- Node.js + npm
- Capacitor CLI
- Android Studio (Windows 11)

## Passos para gerar o app Android

1. **Instale dependências:**

   ```sh
   npm install
   ```

2. **Configure Capacitor:**

   ```sh
   npx cap init
   # (Se já existe capacitor.config.ts, pode pular)
   npx cap add android
   ```

3. **Build web (Next.js export):**

   ```sh
   npm run build:web
   ```

   Isso gera a pasta `out/` com os arquivos estáticos.

4. **Sincronize com Capacitor:**

   ```sh
   npx cap sync android
   ```

5. **Abra o projeto Android:**
   - Abra a pasta `/android` manualmente no Android Studio (Windows)
   - Aguarde o sync do Gradle

6. **No Android Studio:**
   - Aguarde o sync do Gradle.
   - Vá em `Build > Generate Signed Bundle/APK > Android App Bundle (AAB)`.
   - Siga os passos para gerar o arquivo `.aab`.
   - Faça upload no Google Play Console (Internal Testing).

## Personalização

- O appId/package name pode ser alterado em `capacitor.config.ts`.
- Ícones/splash: Substitua os arquivos em `android/app/src/main/res/` conforme necessário.

## Observações

- O app funciona offline-first, usando IndexedDB/localStorage.
- APIs de busca/análise de frases foram migradas para client-side (veja src/lib/cedict.ts).
- SSR/server features foram removidas para compatibilidade com exportação estática.
- A tradução de frases agora é totalmente local e baseada em regras gramaticais + CEDICT.

## Dúvidas?

- Consulte https://capacitorjs.com/docs para detalhes.
