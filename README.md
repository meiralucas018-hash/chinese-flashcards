# 中文闪卡 - Chinese Flashcards

Uma ferramenta de repetição espaçada para aprender caracteres chineses, com prática de traços, análise de frases e breakdown de palavras.

## Funcionalidades
- Prática de flashcards com SRS (spaced repetition)
- Análise de frases e segmentação de palavras
- Busca de caracteres e palavras
- Prática de traços
- Funciona offline-first (IndexedDB/localStorage)
- Pronto para exportação estática e Android via Capacitor

## Desenvolvimento local
```sh
npm install
npm run dev
```

## Exportação estática (para Capacitor/Android)
```sh
npm run build:web
npx cap sync android
npm run android
# Abra o projeto Android no Android Studio para gerar o AAB
```

## Dicionário CC-CEDICT
- O arquivo está em `public/data/cedict.txt`
- Carregado e indexado client-side via `src/lib/cedict.ts`

## Observações
- O app não possui backend/server: todas as buscas e análises são client-side
- Compatível com exportação estática Next.js e Capacitor Android

## Build Android (Windows/Android Studio)
1. Gere os arquivos estáticos: `npm run build:web`
2. Sincronize com Capacitor: `npx cap sync android`
3. Execute: `npm run android` ou abra manualmente com `npx cap add android`
4. No Android Studio, gere o arquivo `.aab` para Google Play Internal Testing

## Licença
MIT

# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun start
```

Open [http://localhost:3000](http://localhost:3000) to see your application running.

## 🤖 Powered by Z.ai

This scaffold is optimized for use with [Z.ai](https://chat.z.ai) - your AI assistant for:

- **💻 Code Generation** - Generate components, pages, and features instantly
- **🎨 UI Development** - Create beautiful interfaces with AI assistance  
- **🔧 Bug Fixing** - Identify and resolve issues with intelligent suggestions
- **📝 Documentation** - Auto-generate comprehensive documentation
- **🚀 Optimization** - Performance improvements and best practices

Ready to build something amazing? Start chatting with Z.ai at [chat.z.ai](https://chat.z.ai) and experience the future of AI-powered development!

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable React components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
└── lib/                # Utility functions and configurations
```

## 🎨 Available Features & Components

This scaffold includes a comprehensive set of modern web development tools:

### 🧩 UI Components (shadcn/ui)
- **Layout**: Card, Separator, Aspect Ratio, Resizable Panels
- **Forms**: Input, Textarea, Select, Checkbox, Radio Group, Switch
- **Feedback**: Alert, Toast (Sonner), Progress, Skeleton
- **Navigation**: Breadcrumb, Menubar, Navigation Menu, Pagination
- **Overlay**: Dialog, Sheet, Popover, Tooltip, Hover Card
- **Data Display**: Badge, Avatar, Calendar

### 📊 Advanced Data Features
- **Tables**: Powerful data tables with sorting, filtering, pagination (TanStack Table)
- **Charts**: Beautiful visualizations with Recharts
- **Forms**: Type-safe forms with React Hook Form + Zod validation

### 🎨 Interactive Features
- **Animations**: Smooth micro-interactions with Framer Motion
- **Drag & Drop**: Modern drag-and-drop functionality with DND Kit
- **Theme Switching**: Built-in dark/light mode support

### 🔐 Backend Integration
- **Authentication**: Ready-to-use auth flows with NextAuth.js
- **Database**: Type-safe database operations with Prisma
- **API Client**: HTTP requests with Fetch + TanStack Query
- **State Management**: Simple and scalable with Zustand

### 🌍 Production Features
- **Internationalization**: Multi-language support with Next Intl
- **Image Optimization**: Automatic image processing with Sharp
- **Type Safety**: End-to-end TypeScript with Zod validation
- **Essential Hooks**: 100+ useful React hooks with ReactUse for common patterns

## 🤝 Get Started with Z.ai

1. **Clone this scaffold** to jumpstart your project
2. **Visit [chat.z.ai](https://chat.z.ai)** to access your AI coding assistant
3. **Start building** with intelligent code generation and assistance
4. **Deploy with confidence** using the production-ready setup

---

Built with ❤️ for the developer community. Supercharged by [Z.ai](https://chat.z.ai) 🚀
