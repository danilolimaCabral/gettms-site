export const WHATSAPP_NUMBER = "5541999499815";
export const WHATSAPP_DISPLAY = "+55 (41) 99949-9815";
export const EMAIL = "contato@getlog.com.br";
export const CNPJ = "54.865.478/0001/85";
export const INSTAGRAM = "https://www.instagram.com/gettms.oficial/";
export const FACEBOOK = "https://www.facebook.com/gettmsoficial/";
export const DEMO_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ24fSDVgjv1a4ePbL6bS0qbBwAsZpdE6ecrDqRr0Jw8MoKLK2QHDTEe6WuSE29vxP30ZrtREdNe";

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Olá! Vim pelo site da GetTMS e quero conhecer a plataforma.",
)}`;

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const NAV_LINKS = [
  { label: "Segmentos", href: "#segmentos" },
  { label: "Plataforma", href: "#plataforma" },
  { label: "Implantação", href: "#implantacao" },
  { label: "Maturidade", href: "#maturidade" },
  { label: "Tracking", href: "#tracking" },
  { label: "Contato", href: "#contato" },
];

export type Segment = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  image: string;
  highlights: string[];
};

export const SEGMENTS: Segment[] = [
  {
    id: "alimentos",
    kicker: "Alimentos",
    title: "Rastreabilidade do pedido à entrega",
    body: "Centralize eventos, prazos, ocorrências e responsáveis para localizar cada etapa do transporte e responder mais rápido quando houver atraso, avaria ou desvio operacional.",
    image: "/img/seg-alimentos.webp",
    highlights: ["Eventos centralizados", "Prazos monitorados", "Ocorrências com responsável"],
  },
  {
    id: "farma",
    kicker: "Farma",
    title: "Controle e rastreabilidade operacional",
    body: "Acompanhe etapas, exceções e informações disponíveis nas integrações para dar mais visibilidade à operação e priorizar respostas em transportes sensíveis — sem substituir requisitos sanitários ou procedimentos regulatórios.",
    image: "/img/seg-farma.webp",
    highlights: ["Exceções priorizadas", "Histórico por carga", "Integrações auditáveis"],
  },
  {
    id: "construcao",
    kicker: "Materiais de construção",
    title: "Mais previsibilidade em múltiplos destinos",
    body: "Compare alternativas de frete, organize múltiplos destinos e trate ocorrências com agilidade para reduzir retrabalho e responder melhor a lojas, obras e clientes.",
    image: "/img/seg-construcao.webp",
    highlights: ["Rotas múltiplas", "Cargas fracionadas", "Menos retrabalho"],
  },
  {
    id: "ecommerce",
    kicker: "E-commerce",
    title: "Frete e prazo para vender melhor",
    body: "Simule fretes conforme as transportadoras integradas, compare custos e prazos e apoie a escolha da melhor opção para cada pedido, com mais clareza para o cliente e para a operação.",
    image: "/img/seg-ecommerce.webp",
    highlights: ["Cotação por pedido", "Prazos confiáveis", "Operação escalável"],
  },
];

export type Feature = {
  id: string;
  number: string;
  title: string;
  body: string;
  bullets: string[];
};

export const FEATURES: Feature[] = [
  {
    id: "simulacao",
    number: "01",
    title: "Simulação de frete inteligente",
    body: "Compare prazos, valores e modalidades com diferentes transportadoras, direto no sistema, usando as tabelas e regras comerciais da sua operação.",
    bullets: ["Cotação multi-transportadora", "Regras de frete por cliente", "Decisão antes do embarque"],
  },
  {
    id: "ocorrencias",
    number: "02",
    title: "Gestão de ocorrências integrada",
    body: "Monitore eventos e resolva imprevistos com agilidade, mantendo toda a equipe informada com histórico, prazo e responsável por cada tratativa.",
    bullets: ["Fluxo de tratativas", "Alertas automáticos", "Histórico completo"],
  },
  {
    id: "afericao",
    number: "03",
    title: "Redução da conta frete",
    body: "Economize com aferição precisa de faturas e escolha estratégica de fornecedores. Divergências aparecem antes do pagamento, não depois do fechamento.",
    bullets: ["Conferência item a item", "Divergências sinalizadas", "Negociação com base em dados"],
  },
  {
    id: "relatorios",
    number: "04",
    title: "Relatórios e desempenho",
    body: "Tome decisões com base em dados: visualize indicadores por transportadora, rota e cliente, e otimize a operação com evidência em vez de percepção.",
    bullets: ["KPIs por transportadora", "Exportação de dados", "Visão por unidade"],
  },
];

export const CLIENTS = [
  "Acampar",
  "Acerofix",
  "Acerosid",
  "Atacadão",
  "Collins",
  "F. Kennedy",
  "Hommes",
  "Kala",
  "Liege",
  "Lumber",
  "Matsuyama",
  "Mensur",
  "Negrão",
  "Plastilit",
  "Revestik",
  "Sertão",
  "SuperPro",
  "TBR",
  "WBR",
  "Worker",
];

export const IMPACT = [
  { value: "01", label: "Cotação", text: "Simule fretes em segundos, não em planilhas." },
  { value: "02", label: "Rastreio", text: "Eventos da coleta à entrega, com responsável." },
  { value: "03", label: "Aferição", text: "Faturas conferidas antes do pagamento." },
  { value: "04", label: "Dados", text: "Indicadores por transportadora, rota e cliente." },
];

export const TRACKING_STEPS = [
  {
    id: "coleta",
    label: "Coleta",
    title: "A carga entra na operação",
    body: "Pedido, volumes e janela de coleta registrados com o transportador escolhido na simulação.",
    event: "CT-e emitido · coleta confirmada",
  },
  {
    id: "transito",
    label: "Em trânsito",
    title: "Cada movimento, um evento",
    body: "Status atualizado pelas integrações das transportadoras, sem digitação manual e sem ponto cego.",
    event: "Em rota · previsão recalculada",
  },
  {
    id: "ocorrencia",
    label: "Ocorrências",
    title: "Imprevisto tratado com prazo",
    body: "Avaria, atraso ou desvio geram tratativa com responsável definido e histórico para auditoria.",
    event: "Ocorrência aberta · responsável atribuído",
  },
  {
    id: "entrega",
    label: "Entrega",
    title: "Entrega comprovada e faturada",
    body: "Comprovante anexado, entrega concluída e fatura aferida contra o frete contratado.",
    event: "Entregue · fatura aferida",
  },
];

export type QuizOption = { label: string; score: number };
export type QuizQuestion = { id: string; question: string; hint: string; options: QuizOption[] };

export const QUIZ: QuizQuestion[] = [
  {
    id: "cotacao",
    question: "Como o frete é cotado hoje?",
    hint: "Cotação",
    options: [
      { label: "Por telefone e planilhas, transportadora a transportadora", score: 0 },
      { label: "Em um sistema próprio, mas sem comparar todas as opções", score: 1 },
      { label: "Simulação integrada com comparação de prazo e valor", score: 2 },
    ],
  },
  {
    id: "status",
    question: "Como o status da carga chega até vocês?",
    hint: "Rastreio",
    options: [
      { label: "O cliente liga para saber onde está", score: 0 },
      { label: "Planilha atualizada manualmente ou WhatsApp do motorista", score: 1 },
      { label: "Tracking automático pelas integrações das transportadoras", score: 2 },
    ],
  },
  {
    id: "ocorrencias",
    question: "O que acontece quando surge uma ocorrência?",
    hint: "Ocorrências",
    options: [
      { label: "Alguém resolve informalmente e fica na memória do time", score: 0 },
      { label: "Registramos em planilha, mas sem prazo ou responsável", score: 1 },
      { label: "Fluxo com responsável, prazo e histórico por carga", score: 2 },
    ],
  },
  {
    id: "faturas",
    question: "Como a conta frete é conferida?",
    hint: "Aferição",
    options: [
      { label: "Amostragem manual, quando sobra tempo", score: 0 },
      { label: "Conferência parcial de algumas transportadoras", score: 1 },
      { label: "Aferição sistemática, item a item, antes do pagamento", score: 2 },
    ],
  },
  {
    id: "integracoes",
    question: "Quantas transportadoras estão integradas ao sistema?",
    hint: "Integrações",
    options: [
      { label: "Nenhuma — tudo é lançado manualmente", score: 0 },
      { label: "Algumas, e o resto ainda vai por e-mail", score: 1 },
      { label: "Todas as principais, com tabelas atualizadas", score: 2 },
    ],
  },
  {
    id: "decisao",
    question: "Como vocês escolhem o fornecedor de transporte?",
    hint: "Decisão",
    options: [
      { label: "Pelo relacionamento e pela urgência do dia", score: 0 },
      { label: "Pelo custo pontual do frete", score: 1 },
      { label: "Por indicadores de prazo, ocorrência e custo juntos", score: 2 },
    ],
  },
];

export const QUIZ_RESULTS = [
  {
    min: 0,
    max: 4,
    title: "Operação reativa",
    body: "A maior parte das decisões depende de telefone, planilha e memória do time. O ganho mais rápido está em centralizar cotação e rastreio — é onde o custo invisível aparece primeiro.",
    recommendation: "Começar pela simulação de frete integrada e pelo tracking automático.",
  },
  {
    min: 5,
    max: 8,
    title: "Em evolução",
    body: "Vocês já têm controle em partes da operação, mas os dados ainda não conversam. Integrar ocorrências e aferição de faturas fecha o ciclo entre o que foi contratado e o que foi cobrado.",
    recommendation: "Priorizar gestão de ocorrências e aferição da conta frete.",
  },
  {
    min: 9,
    max: 12,
    title: "Operação orientada a dados",
    body: "A base está madura: cotação, rastreio e conferência já funcionam de forma estruturada. O próximo salto é usar os indicadores para negociar, redesenhar rotas e ganhar escala.",
    recommendation: "Explorar relatórios avançados e negociação baseada em desempenho.",
  },
];
