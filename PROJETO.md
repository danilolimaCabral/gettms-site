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

## Pendências
- Ré dos caminhões em algumas docas
- Conteúdo de Steps/Clients fora da página após virar cenas (arquivos mantidos)
