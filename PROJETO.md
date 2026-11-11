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

## Filme 3D — trajeto completo (fase atual)
O caminhão protagonista GT-1024 sai do CD, pega a avenida inteira, entra na via expressa, atravessa o trecho rural e a periferia e entrega no Cliente Horizonte, do outro lado da cidade.
- Avenida: 4 faixas com eixo duplo, semáforos que trocam de cor; o caminhão para no vermelho quando está no ritmo da rolagem.
- Trevo: avenida encontra a via expressa, faixa de pedestre, sinal, seta de conversão e parada antes do cruzamento.
- Via expressa: duas pistas por sentido, canteiro central com guard-rail, postes, pórticos "VIA EXPRESSA" e "CLIENTE HORIZONTE · Saída 12", marcos, passarela sobre a pista e tráfego contínuo.
- Trecho rural: campos com sulcos, cerca, fazenda (casa, celeiro, silos), fardos de feno, vacas, rede elétrica e estrada de terra.
- Saída 12: rampa da via expressa para a rua da periferia, com placa.
- Periferia: rua com faixa, calçada, comércio (mercado, padaria, oficina, lanchonete, farmácia...), postes e fios, caixa d'água, ponto de ônibus, sinal e faixa de pedestre.
- Cliente Horizonte: portaria com cancela e totem, pátio com vagas pintadas, cones, paletes e contêiner, 5 docas, empilhadeira em operação, caminhão já carregando e escritório de recebimento com o painel de dados em tempo real.
- Câmera: take de perseguição entre ~0,26 e ~0,88 (atrás, na frente e aéreo), fechando na tela do cliente e numa vista geral do pátio.
- Montagem: asfalto entra por opacidade e as construções crescem em altura, no mesmo estilo do resto da cena.
- Capítulos do scroll: 01 mapa · 02 armazém · 03 pátio · 04 cidade · 05 saída · 06 via expressa · 07 periferia · 08 chegada · 09 doca · 10 análise.

## Pendências
- Modelo PBR no caminhão do hero (próxima fase): trocar o caminhão procedural por GLB com materiais PBR
- Ré dos caminhões em algumas docas
- Conteúdo de Steps/Clients fora da página após virar cenas (arquivos mantidos)
