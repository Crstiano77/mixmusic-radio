
export enum AppTheme {
  DARK_BLUE_VARIATION = 'DARK_BLUE_VARIATION',
  BLACK_RED = 'BLACK_RED'
}

export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  card: string;
  gradient: string;
}

export interface EqPreset {
  name: string;
  gains: number[];
}

export enum VisualizerPattern {
  STARDUST_PRO = 'STARDUST_PRO',
  VECTOR_WAVE = 'VECTOR_WAVE',
  PHANTOM_PEAKS = 'PHANTOM_PEAKS',
  NEON_PULSE = 'NEON_PULSE',
  CYBER_GRID_3D = 'CYBER_GRID_3D'
}

export interface VisualizerSettings {
  enabled: boolean;
  pattern: VisualizerPattern;
  complexity: number;
  speed: number;
  intensity: number;
  bloom: number;
  color?: string;
}
