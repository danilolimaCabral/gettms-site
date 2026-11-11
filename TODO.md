# GetTMS — Redesign premium (TODO)

## 1. Experiência cinematográfica de scrollytelling
- [x] Cena 3D logística em WebGL (Three.js) fixada na tela, montada progressivamente conforme a rolagem: malha do terreno → estrada → caminhão → armazém → contêineres → rota conectada → dados.
- [x] Câmera com movimento suave (damping) e parallax de ponteiro; sem vídeo pesado, 60fps em desktop e degradação graciosa em mobile.
- [x] Legendas de capítulo sincronizadas com a cena, indicador de progresso numerado e transições de texto em fade.
- [x] Hero com proposta de valor centrada em menos custo, mais controle e estratégia, com CTAs "Agendar demonstração" e "Conhecer a solução".

## 2. Soluções por segmento
- [x] Quatro cards com imagem cinematográfica e copy para alimentos, indústria farmacêutica, materiais de construção e e-commerce.

## 3. Plataforma / funcionalidades
- [x] Showcase interativo (tabs) de simulação inteligente de frete, gestão de ocorrências, redução da conta frete e relatórios/desempenho, cada uma com um mock de interface animado.

## 4. Avaliação de maturidade
- [x] Quiz interativo de 6 perguntas com barra de progresso, pontuação e devolutiva por faixa de maturidade, CTA para especialista e recomeço.

## 5. Tracking e fluxo logístico
- [x] Linha do tempo do fluxo completo (coleta, trânsito, rastreio, entrega) com eventos animados e imagem da central de operações.

## 6. Clientes e prova social
- [x] Faixa de logos/nomes de clientes em movimento contínuo e indicadores de impacto sem números inventados.

## 7. Conversão
- [x] CTA final "Fale com um especialista" com formulário (nome, empresa, e-mail, WhatsApp, volume) que monta a mensagem no WhatsApp +55 41 99949-9815.

## 8. Agente Mia
- [x] Widget flutuante persistente com avatar, painel de chat, respostas roteirizadas sobre a plataforma, atalho para demonstração e para a avaliação de maturidade.

## 9. Navegação e rodapé
- [x] Header fixo com blur ao rolar, âncoras suaves, menu mobile e CTA.
- [x] Footer com WhatsApp +55 41 99949-9815, e-mail contato@getlog.com.br, redes sociais, links institucionais e legais.

## 10. Qualidade e entrega
- [x] SEO básico (lang pt-BR, title, description, OG), favicon, rotas declaradas em `/manus-routes.json`, responsivo em 375/768/1280+, sem erros de TypeScript.

## 11. Filme 3D — estrada de saída, trecho rural e cliente distante
- [x] Avenida inteira com eixo duplo, faixas reais e semáforos animados (vermelho/verde).
- [x] Caminhão para no vermelho, faz o trevo e entra na via expressa.
- [x] Via expressa com canteiro, guard-rail, pórticos, marcos, passarela e tráfego.
- [x] Trecho rural com campos, cerca, fazenda, silos, vacas e rede elétrica.
- [x] Saída 12 com rampa para a periferia.
- [x] Periferia com comércio, postes, caixa d'água, ponto de ônibus e sinal.
- [x] Cliente Horizonte com portaria, pátio, docas, empilhadeira e painel de recebimento.
- [x] Câmera de perseguição do início ao fim e capítulos do scroll retimados.
- [x] Modelo PBR no caminhão do hero (GLB semi-truck com pintura getTMS e placa lateral).
- [x] Orientação do caminhão alinhada ao trajeto (sem andar de lado).
- [x] Filme automático: caminhão e capítulos avançam sozinhos, com pausa ao interagir e botão para ligar/desligar.
- [x] Clima dinâmico: ciclo dia/noite + chuva no trecho rural/periferia.
- [x] Caminhão dá ré e encosta de traseira na doca; porta da doca abre e a empilhadeira carrega (200 pedidos · 200 CT-e).
- [x] Reprodução automática da página inteira com pausa ao interagir.
- [x] Otimização mobile: pixel ratio limitado, qualidade adaptativa por FPS, pausa de render com aba oculta.
- [x] Seletor manual de clima (auto, dia, noite, chuva).
- [x] Torre de controle com processo, monitoramento, tracker, simulação e auditoria de CT-e.
- [x] Pausa de render fora da tela para eliminar travamentos.
- [x] Otimização do GLB do caminhão (texturas 1024 + quantização, 3,1 MB → 1,6 MB).
