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
- Caminhão do hero: GLB `semi-truck.glb` (PBR com normal/metal/roughness) pintado na identidade getTMS (carroceria branca, faixa verde, placa "get TMS · GT-1024") e sombra no chão.
- Câmera: take de perseguição entre ~0,26 e ~0,88 (atrás, na frente e aéreo), fechando na tela do cliente e numa vista geral do pátio.
- Montagem: asfalto entra por opacidade e as construções crescem em altura, no mesmo estilo do resto da cena.
- Capítulos do scroll: 01 mapa · 02 armazém · 03 pátio · 04 cidade · 05 saída · 06 via expressa · 07 periferia · 08 chegada · 09 doca · 10 análise.
- Filme automático: a cena avança sozinha (~70s do início ao fim) e troca de capítulo; qualquer gesto (rolar, tocar, tecla) pausa por ~4,5s. Botão "Filme automático" no canto superior esquerdo para pausar/retomar.

## Clima, doca e reprodução automática
- Ciclo dia/noite guiado pelo scroll: dia na cidade, entardecer na via expressa, noite na periferia e na entrega (luz-chave, hemisphere, céu em shader e neblina interpolados).
- Chuva dinâmica (partículas que acompanham a câmera) entre a saída da via expressa e a chegada na periferia.
- Doca do Cliente Horizonte: o caminhão para em frente à porta, dá ré encostando o baú e a porta rolô abre (3,4 s de manobra).
- Empilhadeira carrega o caminhão em ciclo depois da doca; painel mostra 200 pedidos · 200 CT-e · 100% conferido.
- Reprodução automática da página inteira: filme em ~70 s, depois as outras seções avançam sozinhas; qualquer gesto pausa 4 s e retoma.

## Torre de controle e clima manual
- Seletor de clima na cena (Automático, Dia, Noite, Chuva) com transição suave de luz, céu e partículas.
- Seção #torre antes do sistema/relatórios: processo de 6 etapas guiado pelo scroll (simular, emitir CT-e, monitorar, tratar ocorrência, auditar todos os CT-e, decidir).
- Abas: painel ao vivo, tracker do CT-e, simulação de frete e auditoria de todos os CT-e recebidos (tabela x cobrado, status e diferença).
- A cena 3D pausa o render quando sai da tela e com a aba oculta.

## Performance do modelo PBR
- semi-truck.glb otimizado com gltf-transform: texturas 2048² → 1024² e malha quantizada (KHR_mesh_quantization), de 3,1 MB para 1,6 MB (-48%).
- Malha unificada com gltf-transform join: 33 → 7 draw calls (1,8 MB), materiais idênticos deduplicados.
- Cena pausa render fora da tela, aba oculta e qualidade adaptativa por FPS.

## Cenário: comércio e fazenda
- Lojas da avenida e da periferia com placas coloridas e nome (Mercado São José, Farmácia, Lanchonete...).
- Fachadas dos galpões com ondulação metálica, faixa de janelas altas e rodapé.
- Skyline com tons variados, caixa d'água e antenas.
- Fazenda ampliada (1,6x): segundo galpão, moinho com hélices, caixa d'água, curral, trator, silos e campos maiores.

## Trânsito e encerramento
- Veículos ambientes freiam quando o caminhão do cliente ou outro veículo está à frente (via expressa, periferia e avenida).
- O final sobe em zoom de drone acima da via expressa, com as nuvens desaparecendo, mostrando os caminhões seguindo para cada destino.

## Cidade em movimento
- Aeroporto na ala oeste: pista com sinalização e luzes, terminal, torre de controle, hangar e um avião taxiando.
- Margem da via expressa preenchida: posto com cobertura e bombas, conveniência, armazém com docas, pátio com caminhões e três outdoors.
- Três caminhões extras circulando pela avenida, com a mesma lógica de espera.
- Chão com tom mais suave (menos branco) e neblina reduzida no encerramento.

## Interação e ambiente
- Clique em qualquer caminhão da cena abre o painel de tracking com placa, pedido, rota, motorista, ETA e etapas; botão "Acompanhar no filme".
- 12 pedestres novos nas calçadas da avenida, 5 na periferia e 7 carros de passeio a mais.
- Som ambiente sintetizado (WebAudio): tráfego, chuva, grilos à noite e passagens de avião; botão "Som" no controle de clima.

## Correções de modelo e pessoas
- Rodas do caminhão do hero: o modelo GLB traz os dois pneus do eixo numa única malha e a escala aplicada encolhia as rodas para dentro da carroceria (por isso "sumiam"). Agora os pneus são gerados por eixo com bitola fixa, pneu e aro separados, e a carroceria é levantada para eles aparecerem.
- Pedestres: pernas e braços passaram a girar no pivô certo (quadril e ombro), com sapatos, mãos e cabelo (capacete só para os operadores do CD).

## Refino visual e trânsito
- Removidas as palavras gigantes que passavam sobre a cena (peso de blur/blend e poluição visual).
- Carros e caminhões da avenida mantêm distância mínima na mesma faixa (não se sobrepõem mais).
- Carreta do hero com faixa inferior e linha verde de base; rótulo da cena trocado por "Cena 3D · getTMS".

## Caminhão do hero: modelo de catálogo
- Modelo trocado pelo "Semi Truck" do kit Cozy Vehicles (Grab3D), licença CC0 (domínio público, sem atribuição): 49.550 triângulos, texturas 2K, rodas separadas por eixo e carreta com portas nervuradas e pernas de apoio.
- Otimizado com gltf-transform (texturas 1024 + quantização, sem juntar malhas): 3,1 MB → 2,3 MB, mantendo os nós de roda.
- Livery sem achatar detalhes: trator e capô em branco getTMS, textura da carreta preservada (creme com sulcos), faixas verde getTMS e wordmark com o pino aplicados por cima; vidros, cromados e pneus originais mantidos.

## Veículos e fachadas (refino)
- Carros da avenida trocados pelos modelos CC0 do Cozy Vehicles Kit (Sedan, Hatchback, SUV) e pelo Electric Car: texturas 512 + quantização, 437-666 KB cada, rodas próprias por nó.
- Caminhões do cenário passaram a usar os GLBs detalhados (semi-truck, tanker-truck, delivery-truck) com rodas originais; faixas separadas: caminhões nas faixas externas (±4,4) e carros nas centrais (±1,5).
- Fila por faixa corrigida (ordenação frente/trás): distância mínima de 8 m entre carros, 24 m entre caminhões, ninguém se sobrepõe.
- Fallback automático de rodas para qualquer modelo sem nós de roda nomeados.
- Lojas da avenida ganharam fachada texturizada com janelas, platibanda, ar-condicionado e caixa d'água (antes eram caixas lisas).

## Correções de veículos e contêineres
- Rodas duplicadas: as peças procedurais eram capturadas antes das rodas, então as rodas antigas continuavam visíveis ao lado das do modelo GLB. A captura passou a acontecer depois e elas são escondidas junto.
- Carroceria flutuando: removido o "lift" que subia o corpo para deixar os pneus à mostra (era ele que criava o vão entre carroceria e rodas).
- Padrão único de tamanho: todo caminhão da cena (hero, avenida, via expressa, pátio e doca) usa 15,5 m de comprimento e escala 1.
- Via expressa: caminhões estavam em faixas a 0,2 m de distância (praticamente sobrepostos); agora são duas faixas reais a 3,6 m.
- Trânsito de carros: modelo de seguir o da frente, com frenagem proporcional a partir de 26 m e folga mínima de 9 m (antes o carro era empurrado de volta e dava tranco).
- Contêineres do pátio e da cena do pedido ganharam textura ondulada, travessas, postes de canto e marcação getTMS/22G1.

## Frota padronizada
- Todos os caminhões (hero, avenida, via expressa, pátio, doca e cliente) usam o mesmo modelo de semi e o mesmo comprimento: 12,5 m, escala 1. Só a cor da livery muda.
- Caminhões param mais longe do caminhão do hero na avenida (folga de 17-19 m), mantendo a regra de faixa separada: caminhões nas faixas externas, carros nas centrais.

## Refino urbano final
- Calçada com textura de lajota (contraste suave) em vez de branco liso.
- Mobiliário urbano na avenida: bancos de madeira, lixeiras com aro metálico, hidrantes, placas de limite 40 km/h e parada de ônibus coberta com painel "Ponto · Linha 22".
- Removida a etiqueta flutuante do caminhão da via expressa (aparecia como cartão preto sobre a pista).

## Cidade preenchida (vazios)
- Quadras vazias ganharam prédios baixos (5-14 m) com fachada de janelas, platibanda e caixa d'água na laje, sorteados de forma determinística (seed fixa) e sem encostar nos prédios, lojas, CD e avenida já existentes.
- Praça na quadra oeste com gramado, lago, sete árvores e o mobiliário da avenida.
- Estacionamento com faixas pintadas e seis carros parados.
- Horizonte: ~330 quadras distantes em 3 InstancedMesh (1 draw call cada) com tons variados e clareiras, mantendo livre a faixa da via expressa.
- Densidade reduzida (42% dos lotes ficam livres) para preservar o desempenho em celular.

## Acessibilidade e SEO
- Pré-renderização: `build:static` roda `scripts/prerender.py`, que abre o build em Chromium e grava o DOM final em `dist/public/index.html` (244 KB com hero, seções e FAQ). O Google passa a ver o conteúdo sem executar JS; o React assume normalmente no navegador.
- `robots.txt` e `sitemap.xml` publicados.
- Link "Pular para o conteúdo" (`.skip-link`) e foco visível em links, botões e elementos com `tabindex`.
- Canvas da cena com `aria-hidden` e descrição textual da jornada para leitores de tela.
- Autoplay desligado quando o sistema pede `prefers-reduced-motion`; animações e transições reduzidas por CSS nessa preferência.
- Torre de controle: `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, `aria-controls`, navegação por setas.

## Clima automático e performance
- Removida a barra de clima/som: o clima segue o roteiro (dia → chuva → noite) e o som ambiente entra sozinho no primeiro gesto do usuário.
- LOD do caminhão: `semi-truck-low.glb` (18.908 triângulos, 683 KB, textura 512) para todo o tráfego; o hero mantém o modelo completo. Triângulos na vista da cidade: 1,14M → 637 mil.
- Prédios das quadras, platibandas, caixas d'água e árvores agrupados com `mergeGeometries` (poucos meshes em vez de centenas).
- `renderer.compile()` antes do filme, para evitar travadas na primeira exibição de cada material.
- Qualidade adaptativa em degraus: pixel ratio 1,5 → 1,25 → 1 → 0,8; abaixo de 26 fps renderiza metade dos quadros; sobe de novo se passar de 58 fps.
- Overlay do React atualiza no máximo a cada 80 ms, sem competir com o loop 3D.
- Diagnóstico: `window.__gettmsInfo` expõe updateMs, renderMs, fps, draw calls, triângulos, texturas e pixel ratio.

## CD do cliente em nível executivo
- Plataformas niveladoras, sapatas, bollards amarelos com tampo, luz verde de doca livre e placas "DOCA 01..05".
- Cobertura com sheds translúcidos, guarda-corpo, exaustores com chapéu, calhas e condutores.
- Fachadas laterais com faixa de vidro, montantes, porta de pessoal e placa de saída.
- Pátio com setas de manobra, faixa de pedestre, marcação "PARE", três postes de iluminação, cerca perimetral com mourões e árvores alinhadas.

## Realismo e telhados
- Teto dos prédios sem janelas: a textura de fachada ganhou uma área lisa usada por UV nos vértices com normal vertical; o horizonte usa material de cobertura separado por face.
- Coberturas levemente mais escuras que a parede, com platibanda e caixa d'água.
- Sombra de contato (gradiente radial) em uma única malha mesclada sob as quadras, para os prédios "assentarem" no chão.
- Iluminação baseada em ambiente (IBL) via PMREM + RoomEnvironment, sem download.
- Sombras reais: sol com shadow map 768² seguindo o caminhão (±34 m); desligam sozinhas quando a qualidade adaptativa cai.

## Normal maps nas fachadas
- `heightToNormalTexture()` converte a luminância da textura de fachada em normal map (Sobel), gerado no cliente: peso extra de download zero.
- Aplicado nas lojas, nas torres e nas quadras mescladas (normalScale 0.45–0.5), dando relevo às janelas e ao rodapé.

## Prédios de catálogo, sombras e baú
- Torres da avenida substituídas por 3 modelos CC0 (Grab3D): arranha-céu de vidro, prédio comercial e residencial, com texturas 1024, quantização e `ground_slab` removida. Caixas continuam como fallback e no anel distante.
- Fachadas procedurais ganharam estilos (vidro, grade e faixa horizontal) com normal map gerado por luminância; `ensureNormal()` resolve o normal map após clonar texturas.
- Sombras do sol desligadas (pedido do cliente); fica só a sombra de contato suave sob as quadras.
- Baú: arte 4:1 centralizada (pino + wordmark + filete + assinatura), faixas verdes com offset proporcional e sem z-fighting.

## Pendências
- Ré dos caminhões em algumas docas
- Conteúdo de Steps/Clients fora da página após virar cenas (arquivos mantidos)
