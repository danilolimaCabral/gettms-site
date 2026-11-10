# GetTMS — estado do projeto

Referência visual pedida pelo cliente: foto noturna de CD com docas iluminadas (qualidade/realismo), mas tema do site **claro**.

## Estrutura
- `client/src/components/site/ScrollStage.tsx` — filme de rolagem (1400svh), 10 capítulos com chips, hero, mapa interativo (topo-direita), botão 360 nos CTAs, trilho lateral, dica "Role".
- `client/src/scene/logisticsScene.ts` — cena Three.js: armazém, via, caminhão principal em loop contínuo (CatmullRom), frota getTMS, CD Matsuyama (6 docas, 76 m), pátio com vagas, pátio de contêineres + empilhadeira, torre de análise (14 estações com dashboards), CD Norte/Sul/Leste/Oeste/Alfa/Beta, tráfego contínuo, modo 360 (`setOrbit`, `orbitBy`).
- `client/src/pages/Home.tsx` — ScrollStage + Clients + FinalCta + Footer + Mia.
- `client/src/components/site/SiteHeader.tsx` — navegação por progresso (`gettms:seek`).

## Decisões
- Tema claro (tokens em `client/src/index.css`).
- Cena montada desde o início (`pb = Math.max(0.86, p)`).
- Caminhão estaciona de ré; anda em faixa própria.
- Zoom de ~20% por capítulo.

## Checkpoints
- 1f5240d — layout corrigido, mapa no topo, botão 360, carros com faróis.

## Pendente
- Publicar (deploy) e revisar no celular real.
- Melhorias opcionais: modelos de caminhão/carro mais detalhados, mais cenas distantes.
