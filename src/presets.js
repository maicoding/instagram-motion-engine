export const GOOGLE_FONTS = [
  'Syne',
  'Space Mono',
  'Bebas Neue',
  'Unbounded',
  'Outfit',
  'Archivo Black',
  'Manrope',
];

export const BLEND_MODES = [
  'source-over',
  'screen',
  'multiply',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
];

export const WAVE_OPTIONS = ['off', 'sine', 'triangle', 'saw', 'pulse'];
export const LOOP_OPTIONS = ['loop', 'pingpong', 'once'];
export const ARRANGEMENTS = ['single', 'ring', 'scatter', 'line', 'stack'];
export const SHAPE_PRESETS = ['blob', 'star', 'ribbon'];

export const CANVAS_PRESETS = [
  { id: 'ig-post', label: 'Instagram 4:5', width: 1080, height: 1350 },
  { id: 'story', label: 'Story 9:16', width: 1080, height: 1920 },
  { id: 'square', label: 'Square 1:1', width: 1080, height: 1080 },
];

export const BUILT_IN_LOGOS = [
  {
    id: 'tc-logo',
    name: 'TC Logo',
    src: '/logos/tclogo.svg',
  },
  {
    id: 'pixel-logo',
    name: 'Pixel Logo',
    src: '/logos/pixel-logo.png',
  },
];

export const createOscillator = (wave = 'off', amp = 0, freq = 0.25, phase = 0, noise = 0) => ({
  wave,
  amp,
  freq,
  phase,
  noise,
});

const createBaseLayer = (kind, name) => ({
  id: `${kind}_${Math.random().toString(36).slice(2, 9)}`,
  kind,
  name,
  visible: true,
  opacity: 0.9,
  blendMode: 'source-over',
  blur: 0,
  transform: {
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
  },
  timeline: {
    inPoint: 0,
    outPoint: 8,
    fadeIn: 0.35,
    fadeOut: 0.45,
    speed: 1,
    loopMode: 'loop',
  },
  motion: {
    x: createOscillator('sine', 0.03, 0.18, 0),
    y: createOscillator('triangle', 0.03, 0.12, 0.15),
    scale: createOscillator('sine', 0.08, 0.2, 0.3),
    rotation: createOscillator('sine', 10, 0.12, 0.15),
    opacity: createOscillator('off', 0, 0.5, 0),
  },
  fx: {
    jitter: 0,
    glitch: 0,
  },
});

export const createShapeLayer = (index = 1) => ({
  ...createBaseLayer('shape', `Shape ${index}`),
  opacity: 0.82,
  blendMode: 'screen',
  transform: {
    x: 0.53,
    y: 0.46,
    scale: 1,
    rotation: 0,
  },
  motion: {
    x: createOscillator('sine', 0.04, 0.1, 0),
    y: createOscillator('triangle', 0.05, 0.08, 0.1),
    scale: createOscillator('sine', 0.16, 0.12, 0.25),
    rotation: createOscillator('sine', 18, 0.06, 0.1),
    opacity: createOscillator('off', 0, 0.2, 0),
  },
  fx: {
    jitter: 0.01,
    glitch: 0.08,
  },
  shape: {
    preset: 'blob',
    fill: '#8cf3de',
    stroke: '#f8ff72',
    lineWidth: 0,
    instances: 6,
    spread: 0.4,
    size: 0.18,
    distortion: 0.28,
    arrangement: 'ring',
  },
});

export const createTextLayer = (index = 1) => ({
  ...createBaseLayer('text', `Text ${index}`),
  opacity: 1,
  transform: {
    x: 0.5,
    y: 0.29,
    scale: 1,
    rotation: 0,
  },
  motion: {
    x: createOscillator('triangle', 0.015, 0.08, 0),
    y: createOscillator('sine', 0.02, 0.12, 0.25),
    scale: createOscillator('sine', 0.03, 0.16, 0.4),
    rotation: createOscillator('sine', 4, 0.08, 0.1),
    opacity: createOscillator('pulse', 0.07, 0.25, 0),
  },
  fx: {
    jitter: 0.003,
    glitch: 0.18,
  },
  text: {
    value: index === 1 ? 'SIGNAL\nENGINE' : 'LAYER',
    font: 'Syne',
    weight: 800,
    size: 152,
    tracking: 4,
    leading: 0.86,
    color: '#f5f7ff',
    outline: 0,
    layout: 'single',
    instances: 1,
    spread: 0.2,
    align: 'center',
  },
});

export const createLogoLayer = (index = 1) => ({
  ...createBaseLayer('logo', `Logo ${index}`),
  opacity: 0.92,
  blendMode: 'screen',
  transform: {
    x: 0.5,
    y: 0.76,
    scale: 1,
    rotation: 0,
  },
  motion: {
    x: createOscillator('triangle', 0.03, 0.09, 0),
    y: createOscillator('sine', 0.02, 0.15, 0.3),
    scale: createOscillator('sine', 0.12, 0.22, 0.25),
    rotation: createOscillator('saw', 24, 0.03, 0.4),
    opacity: createOscillator('pulse', 0.08, 0.35, 0),
  },
  fx: {
    jitter: 0.004,
    glitch: 0.1,
  },
  assetSrc: BUILT_IN_LOGOS[0].src,
  assetName: BUILT_IN_LOGOS[0].name,
  logo: {
    tint: '#ffffff',
    preserveColor: false,
    size: 0.2,
    instances: 3,
    spread: 0.32,
    arrangement: 'line',
  },
});

export const createImageLayer = (index = 1) => ({
  ...createBaseLayer('image', `Image ${index}`),
  opacity: 0.65,
  blendMode: 'lighten',
  blur: 2,
  transform: {
    x: 0.48,
    y: 0.57,
    scale: 1,
    rotation: 0,
  },
  motion: {
    x: createOscillator('sine', 0.02, 0.11, 0),
    y: createOscillator('triangle', 0.03, 0.07, 0.2),
    scale: createOscillator('sine', 0.08, 0.15, 0.1),
    rotation: createOscillator('sine', 12, 0.04, 0.3),
    opacity: createOscillator('off', 0, 0.5, 0),
  },
  fx: {
    jitter: 0.002,
    glitch: 0.04,
  },
  assetSrc: '',
  assetName: '',
  image: {
    tint: '#83ffe0',
    preserveColor: true,
    size: 0.34,
    instances: 1,
    spread: 0.18,
    arrangement: 'single',
  },
});

export const createInitialScene = () => ({
  presetId: 'ig-post',
  playback: {
    time: 0,
    duration: 8,
    fps: 30,
    rate: 1,
    loop: true,
    playing: true,
  },
  background: {
    mode: 'gradient',
    colorA: '#07090d',
    colorB: '#10141f',
    colorC: '#172d2a',
    angle: 135,
    imageSrc: '',
    vignette: 0.28,
  },
  globalFx: {
    scanlines: 0.1,
    noise: 0.08,
    displacement: 0.08,
    chromatic: 0.12,
    ghost: 0.1,
  },
  guides: {
    safeZone: true,
    grid: true,
  },
  layers: [
    createShapeLayer(1),
    createTextLayer(1),
    createLogoLayer(1),
  ],
});
