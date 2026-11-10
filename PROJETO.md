# GetTMS — estado do projeto

## Publicação
- Produção (Vercel): https://gettms-site.vercel.app
- Repositório: https://github.com/danilolimaCabral/gettms-site — push em `main` publica automático
- Projeto Vercel `gettms-site` (team_swC6dBlNuAtqYl5CA2GElq8I): framework vite, build `pnpm build:static`, saída `dist/public`, node 22.x
- Checkpoint Manus: repositório canônico do Webdev (`origin main`)

## Estrutura da página (tudo guiado por scroll)
1. `ScrollStage` — filme 3D (1400svh, 10 capítulos, cena montada pelo scroll, mapa interativo, 360)
2. `SegmentsScenes` — 4 cenas sticky (alimentos, farma, construção, e-commerce) + `SegmentGraphic` (SVG)
3. `PlatformScenes` — 4 cenas sticky com notebook que abre no scroll; comparação de transportadoras com check
4. `SceneShell` + `Maturity` — quiz de maturidade em cena de tela cheia (fundo claro)
5. `SceneShell` + `Tracking` — tracking em cena de tela cheia
6. `SceneShell` + `FinalCta` — contato em cena de tela cheia
7. `Clients`, `SiteFooter`, `Mia`

## Marca
- Logo vetorial própria em `Logo.tsx` (tile escuro + marca verde + wordmark get/TMS). O lockup oficial (marca nos dois lados) parece cortado em tamanho pequeno; PNGs oficiais ficam em `client/public/brand/`.
- OG image: `client/public/brand/og-image.png`; favicon `/favicon.svg` e `/favicon.png`

## 3D
- Cena em `client/src/scene/logisticsScene.ts` (Three.js, chunk separado)
- Modelos GLB em `client/public/models/` (fontes em ASSETS.md)

## Pendências
- Ré dos caminhões em algumas docas
- Conteúdo de Steps/Clients fora da página após virar cenas (arquivos mantidos)
