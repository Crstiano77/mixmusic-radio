
import { AppTheme, ThemeConfig, EqPreset, VisualizerPattern, VisualizerSettings } from './types';

export const STREAM_URL = 'https://stream.zeno.fm/sn4w5hvfppiuv';
export const METADATA_URL = 'https://api.zeno.fm/mounts/metadata/subscribe/sn4w5hvfppiuv';

export const UI_STRINGS = {
  brand: {
    main: "MIX MUSIC",
    sub: "STREAM",
    tagline: "Engenharia de Som Professional"
  },
  status: {
    online: "TRANSMISSÃO AO VIVO",
    offline: "SINAL EM ESPERA",
    connecting: "ESTABELECENDO CONEXÃO...",
    stalled: "OTIMIZANDO BUFFER...",
    idle: "PRONTO PARA CONECTAR",
    signalStable: "SINAL ESTÁVEL",
    signalInterrupted: "AGUARDANDO CONEXÃO",
    onAir: "NO AR",
    bitrate: "128 KBPS / 44.1 KHZ"
  },
  panels: {
    eq: {
      title: "Equalização Pro",
      subtitle: "Processamento de Sinais"
    },
    timer: {
      title: "Automação",
      subtitle: "Gestão de Tempo"
    },
    visualizer: {
      title: "Visualizador",
      subtitle: "Winamp Pro Edition",
      mode: "Algoritmo de Display",
      palette: "Espectro Visual",
      status: "Status do Visualizador",
      statusDesc: "Ativar ou desativar renderização em tempo real",
      complexity: "Densidade de Render",
      intensity: "Sensibilidade",
      speed: "Refresh Rate",
      bloom: "Brilho Dinâmico"
    }
  },
  actions: {
    share: "Compartilhar Transmissão",
    copied: "Link Copiado!",
    sharing: "Abrindo Menu...",
    shareMessage: "Ouça a Mix Music | Engenharia de Som Profissional: "
  }
};

export const VERSES = [
    "\"O Senhor é o meu pastor e nada me faltará.\" - Salmos 23:1",
    "\"Direi do Senhor: Ele é o meu refúgio e a minha fortaleza.\" - Salmos 91:2",
    "\"O Senhor é quem te guarda; o Senhor é a tua sombra.\" - Salmos 121:5",
    "\"O choro pode durar uma noite, mas a alegria vem pela manhã.\" - Salmos 30:5",
    "\"Vinde a mim, todos os que estais cansados e oprimidos.\" - Mateus 11:28",
    "\"O Senhor está perto dos que têm o coração quebrantado.\" - Salmos 34:18",
    "\"A paz de Deus, que excede todo o entendimento, guardará os vossos corações.\" - Filipenses 4:7",
    "\"Tudo posso naquele que me fortalece.\" - Filipenses 4:13",
    "\"Se Deus é por nós, quem será contra nós?\" - Romanos 8:31",
    "\"Lâmpada para os meus pés é tua palavra, e luz para o meu caminho.\" - Salmos 119:105"
];

export const THEMES: Record<AppTheme, ThemeConfig> = {
  [AppTheme.DARK_BLUE_VARIATION]: {
    primary: '#3B82F6',
    secondary: '#1E3A8A',
    accent: '#60A5FA',
    bg: '#020617',
    card: '#0F172A',
    gradient: 'from-blue-900/10 via-slate-950 to-black'
  },
  [AppTheme.BLACK_RED]: {
    primary: '#DC2626',
    secondary: '#111827',
    accent: '#F87171',
    bg: '#050505',
    card: '#121212',
    gradient: 'from-red-900/10 via-zinc-950 to-black'
  }
};

export const DEFAULT_EQ_PRESETS: EqPreset[] = [
  { name: 'Pure Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Warm Bass', gains: [5.5, 4.2, 3.0, 1.5, 0, 0, 0, 0, 0, 0] },
  { name: 'Studio Master', gains: [2.5, 1.2, 0.5, -0.5, 0.2, 1.5, 2.8, 3.5, 2.5, 1.8] },
  { name: 'Bright Vocal', gains: [-1.5, -1.0, -0.5, 0.5, 2.5, 4.2, 5.0, 3.8, 2.0, 1.0] },
  { name: 'Deep Punch', gains: [8.5, 6.2, 2.5, -1.5, -2.5, 0, 1.5, 2.5, 3.5, 4.2] },
];

export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  enabled: true,
  pattern: VisualizerPattern.STARDUST_PRO,
  complexity: 0.4, // Reduzido para performance inicial
  speed: 0.2,
  intensity: 0.7,
  bloom: 0.0, // Bloom desativado por padrão para poupar GPU
  color: undefined
};
