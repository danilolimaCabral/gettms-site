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
