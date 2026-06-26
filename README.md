# SubMM — Subtitle Translator

Chinese Donghua subtitle → English + Myanmar translation platform.

## Features (Phase 1)

- URL paste → yt-dlp subtitle download
- SRT / VTT text paste
- Claude API Myanmar translation with custom glossary
- Download English .srt + Myanmar .srt
- Web editor — line-by-line review & fix
- Glossary manager — custom terms per series

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install yt-dlp (system binary)
pip install yt-dlp
# or: brew install yt-dlp  (macOS)

# 3. Environment
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY

# 4. Run
npm run dev
```

Open http://localhost:3000

## Deploy to Railway

```bash
# Add environment variable in Railway dashboard:
# ANTHROPIC_API_KEY = sk-ant-...

railway login
railway up
```

Railway auto-detects Next.js. yt-dlp is available via nixpacks.

## File Structure

```
app/
  page.tsx          ← main translate page
  editor/page.tsx   ← subtitle editor
  glossary/page.tsx ← glossary manager
  api/
    download/       ← yt-dlp API route
    translate/      ← Claude translate API route
lib/
  srt.ts            ← SRT parse/format utilities
  glossary.ts       ← glossary storage + Claude prompts
types/
  index.ts          ← TypeScript types
```

## Translation Cost

~$0.20 per episode (1000 subtitle lines)
Sonnet 4.6: $3/M input + $15/M output tokens
# subtitle-platform
