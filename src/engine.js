const TWO_PI = Math.PI * 2;
const scratch = new Map();
const tintCache = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fract = (value) => value - Math.floor(value);

const getScratchCanvas = (key, width, height) => {
  let canvas = scratch.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    scratch.set(key, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  } else {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
  }
  return canvas;
};

const hash = (seed) => fract(Math.sin(seed * 12.9898) * 43758.5453);

const smoothNoise = (time, seed) => {
  const a = Math.sin(time * 1.37 + seed * 7.11);
  const b = Math.sin(time * 3.91 + seed * 3.73) * 0.45;
  const c = Math.sin(time * 0.77 + seed * 11.3) * 0.25;
  return (a + b + c) / 1.7;
};

const stringSeed = (value) =>
  [...String(value)].reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0) || 1;

const sampleWave = (wave, time, phase = 0) => {
  const t = time + phase;
  if (wave === 'sine') {
    return Math.sin(TWO_PI * t);
  }
  if (wave === 'triangle') {
    return 1 - 4 * Math.abs(Math.round(t - 0.25) - (t - 0.25));
  }
  if (wave === 'saw') {
    return 2 * fract(t) - 1;
  }
  if (wave === 'pulse') {
    return fract(t) > 0.55 ? 1 : -1;
  }
  return 0;
};

const modulate = (base, oscillator, time, seed) => {
  if (!oscillator) {
    return base;
  }
  const motion = sampleWave(oscillator.wave, time * oscillator.freq, oscillator.phase) * oscillator.amp;
  const noise = smoothNoise(time * Math.max(0.1, oscillator.freq), seed) * oscillator.noise;
  return base + motion + noise;
};

const getEnvelope = (timeline, globalTime, duration) => {
  const inPoint = clamp(timeline.inPoint, 0, duration);
  const outPoint = clamp(Math.max(inPoint + 0.05, timeline.outPoint), inPoint + 0.05, duration);

  if (timeline.loopMode === 'once' && (globalTime < inPoint || globalTime > outPoint)) {
    return { visible: false, localTime: 0, envelope: 0 };
  }

  const span = outPoint - inPoint;
  let time = Math.max(0, globalTime - inPoint) * timeline.speed;

  if (timeline.loopMode === 'loop' || timeline.loopMode === 'pingpong') {
    time = span === 0 ? 0 : time % span;
    if (timeline.loopMode === 'pingpong') {
      const doubled = span === 0 ? 0 : (Math.max(0, globalTime - inPoint) * timeline.speed) % (span * 2);
      time = doubled > span ? span - (doubled - span) : doubled;
    }
  } else {
    time = clamp(time, 0, span);
  }

  const fadeIn = Math.min(timeline.fadeIn, span / 2);
  const fadeOut = Math.min(timeline.fadeOut, span / 2);
  const fadeInMix = fadeIn > 0 ? clamp(time / fadeIn, 0, 1) : 1;
  const fadeOutMix = fadeOut > 0 ? clamp((span - time) / fadeOut, 0, 1) : 1;

  return {
    visible: true,
    localTime: time,
    envelope: Math.min(fadeInMix, fadeOutMix),
  };
};

const getInstanceOffset = (arrangement, index, count, spread, seed) => {
  if (count <= 1 || arrangement === 'single') {
    return { x: 0, y: 0, rotation: 0, scale: 1 };
  }

  const center = (count - 1) / 2;
  const normalized = center === 0 ? 0 : (index - center) / center;

  if (arrangement === 'line') {
    return { x: normalized * spread * 0.55, y: 0, rotation: normalized * 0.12, scale: 1 };
  }

  if (arrangement === 'stack') {
    return { x: normalized * spread * 0.18, y: normalized * spread * 0.42, rotation: normalized * 0.08, scale: 1 - Math.abs(normalized) * 0.08 };
  }

  if (arrangement === 'ring') {
    const angle = (index / count) * TWO_PI + seed * 0.01;
    const radius = spread * 0.32;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      rotation: angle,
      scale: 0.9 + hash(seed + index) * 0.25,
    };
  }

  const angle = index * 2.3999632297 + seed * 0.03;
  const radius = Math.sqrt((index + 0.5) / count) * spread * 0.48;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    rotation: angle,
    scale: 0.82 + hash(seed + index * 5) * 0.35,
  };
};

const getTintedImage = (image, color) => {
  const key = `${image.src || image.width}:${color}:${image.width}:${image.height}`;
  const cached = tintCache.get(key);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(image, 0, 0);
  tintCache.set(key, canvas);
  return canvas;
};

const drawBlob = (ctx, size, distortion, seed) => {
  ctx.beginPath();
  for (let step = 0; step <= 24; step += 1) {
    const angle = (step / 24) * TWO_PI;
    const radius = size * (0.62 + hash(seed + step) * distortion);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (step === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};

const drawStar = (ctx, size, distortion) => {
  ctx.beginPath();
  for (let step = 0; step < 12; step += 1) {
    const angle = (step / 12) * TWO_PI;
    const radius = step % 2 === 0 ? size : size * (0.35 + distortion * 0.35);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (step === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
};

const drawRibbon = (ctx, size, distortion) => {
  const length = size * 2.1;
  ctx.beginPath();
  ctx.moveTo(-length * 0.5, -size * 0.18);
  ctx.bezierCurveTo(-size * 0.55, -size * (0.72 + distortion), size * 0.4, size * (0.88 + distortion), length * 0.5, size * 0.12);
  ctx.bezierCurveTo(size * 0.28, size * 0.42, -size * 0.22, size * 0.25, -length * 0.5, size * 0.46);
  ctx.closePath();
};

const drawShapeLayer = (ctx, layer, width, height, state) => {
  const { shape } = layer;
  const count = Math.max(1, shape.instances);
  const minDim = Math.min(width, height);
  const seed = stringSeed(layer.id);

  ctx.fillStyle = shape.fill;
  ctx.strokeStyle = shape.stroke;
  ctx.lineWidth = shape.lineWidth;

  for (let index = 0; index < count; index += 1) {
    const offset = getInstanceOffset(shape.arrangement, index, count, shape.spread, seed);
    const jitterX = layer.fx.jitter * smoothNoise(state.time * 2 + index, seed + index * 11);
    const jitterY = layer.fx.jitter * smoothNoise(state.time * 2.3 + index, seed + index * 17);
    const baseSize = minDim * shape.size * state.scale * offset.scale;
    ctx.save();
    ctx.translate((state.x + offset.x + jitterX) * width, (state.y + offset.y + jitterY) * height);
    ctx.rotate((state.rotation * Math.PI) / 180 + offset.rotation);
    if (shape.preset === 'star') {
      drawStar(ctx, baseSize, shape.distortion);
    } else if (shape.preset === 'ribbon') {
      drawRibbon(ctx, baseSize, shape.distortion);
    } else {
      drawBlob(ctx, baseSize, shape.distortion, seed + index * 13);
    }
    ctx.fill();
    if (shape.lineWidth > 0) {
      ctx.stroke();
    }
    ctx.restore();
  }
};

const drawTextPass = (ctx, layer, x, y, rotation, alpha, colorOffset) => {
  const { text } = layer;
  const lines = text.value.split('\n');
  const lineHeight = text.size * text.leading;
  const totalHeight = (lines.length - 1) * lineHeight;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillStyle = colorOffset.color || text.color;
  ctx.strokeStyle = text.color;
  ctx.textAlign = text.align;
  ctx.textBaseline = 'middle';
  ctx.font = `${text.weight} ${text.size}px "${text.font}", sans-serif`;
  ctx.letterSpacing = `${text.tracking}px`;

  lines.forEach((line, index) => {
    const lineY = index * lineHeight - totalHeight / 2;
    if (text.outline > 0) {
      ctx.lineWidth = text.outline;
      ctx.strokeText(line, colorOffset.x, lineY + colorOffset.y);
    }
    ctx.fillText(line, colorOffset.x, lineY + colorOffset.y);
  });
  ctx.restore();
};

const drawTextLayer = (ctx, layer, width, height, state) => {
  const { text } = layer;
  const count = text.layout === 'single' ? 1 : Math.max(1, text.instances);
  const seed = stringSeed(layer.id);

  for (let index = 0; index < count; index += 1) {
    const offset = getInstanceOffset(text.layout, index, count, text.spread, seed);
    const jitterX = layer.fx.jitter * smoothNoise(state.time * 3 + index, seed + index * 3);
    const jitterY = layer.fx.jitter * smoothNoise(state.time * 2.6 + index, seed + index * 7);
    const px = (state.x + offset.x + jitterX) * width;
    const py = (state.y + offset.y + jitterY) * height;
    const localRotation = state.rotation + offset.rotation * 40;

    if (layer.fx.glitch > 0) {
      drawTextPass(ctx, layer, px, py, localRotation, 0.45 + layer.fx.glitch * 0.15, {
        color: '#ff4d7a',
        x: -layer.fx.glitch * 28,
        y: 0,
      });
      drawTextPass(ctx, layer, px, py, localRotation, 0.45 + layer.fx.glitch * 0.15, {
        color: '#5bf7ff',
        x: layer.fx.glitch * 28,
        y: 0,
      });
    }

    drawTextPass(ctx, layer, px, py, localRotation, 1, { color: null, x: 0, y: 0 });
  }
};

const drawAssetLayer = (ctx, layer, width, height, state, image, settings) => {
  if (!image) {
    return;
  }

  const count = Math.max(1, settings.instances);
  const seed = stringSeed(layer.id);
  const minDim = Math.min(width, height);
  const tintTarget = settings.preserveColor ? image : getTintedImage(image, settings.tint);

  for (let index = 0; index < count; index += 1) {
    const offset = getInstanceOffset(settings.arrangement, index, count, settings.spread, seed);
    const jitterX = layer.fx.jitter * smoothNoise(state.time * 2.8 + index, seed + index * 23);
    const jitterY = layer.fx.jitter * smoothNoise(state.time * 3.1 + index, seed + index * 29);
    const size = minDim * settings.size * state.scale * offset.scale;
    const ratio = tintTarget.width / tintTarget.height;
    const drawWidth = size;
    const drawHeight = size / ratio;
    const drawX = (state.x + offset.x + jitterX) * width;
    const drawY = (state.y + offset.y + jitterY) * height;
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate((state.rotation * Math.PI) / 180 + offset.rotation * 0.45);
    if (layer.fx.glitch > 0) {
      ctx.globalAlpha *= 0.35;
      ctx.drawImage(tintTarget, -drawWidth / 2 - layer.fx.glitch * 18, -drawHeight / 2, drawWidth, drawHeight);
      ctx.drawImage(tintTarget, -drawWidth / 2 + layer.fx.glitch * 18, -drawHeight / 2, drawWidth, drawHeight);
      ctx.globalAlpha /= 0.35;
    }
    ctx.drawImage(tintTarget, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }
};

const applyPostEffects = (ctx, width, height, globalFx, time) => {
  const sourceCanvas = getScratchCanvas('source', width, height);
  const sourceCtx = sourceCanvas.getContext('2d');
  sourceCtx.clearRect(0, 0, width, height);
  sourceCtx.drawImage(ctx.canvas, 0, 0, width, height);
  ctx.clearRect(0, 0, width, height);

  if (globalFx.displacement > 0) {
    for (let y = 0; y < height; y += 1) {
      const offset = Math.sin(y * 0.022 + time * 4.4) * globalFx.displacement * 18;
      ctx.drawImage(sourceCanvas, 0, y, width, 1, offset, y, width, 1);
    }
  } else {
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }

  if (globalFx.ghost > 0) {
    ctx.save();
    ctx.globalAlpha = globalFx.ghost * 0.35;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(sourceCanvas, 14 * globalFx.ghost, 10 * globalFx.ghost, width, height);
    ctx.restore();
  }

  if (globalFx.chromatic > 0) {
    const tintCanvas = getScratchCanvas('chromatic', width, height);
    const tintCtx = tintCanvas.getContext('2d');
    tintCtx.clearRect(0, 0, width, height);
    tintCtx.drawImage(sourceCanvas, 0, 0, width, height);
    tintCtx.globalCompositeOperation = 'source-atop';
    tintCtx.fillStyle = '#ff4866';
    tintCtx.fillRect(0, 0, width, height);

    const cyanCanvas = getScratchCanvas('chromatic-cyan', width, height);
    const cyanCtx = cyanCanvas.getContext('2d');
    cyanCtx.clearRect(0, 0, width, height);
    cyanCtx.drawImage(sourceCanvas, 0, 0, width, height);
    cyanCtx.globalCompositeOperation = 'source-atop';
    cyanCtx.fillStyle = '#5bf7ff';
    cyanCtx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = globalFx.chromatic * 0.22;
    ctx.drawImage(tintCanvas, -18 * globalFx.chromatic, 0, width, height);
    ctx.drawImage(cyanCanvas, 18 * globalFx.chromatic, 0, width, height);
    ctx.restore();
  }

  if (globalFx.scanlines > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.12 + globalFx.scanlines * 0.2})`;
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.restore();
  }

  if (globalFx.noise > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${globalFx.noise * 0.18})`;
    const dots = Math.floor(width * height * globalFx.noise * 0.0008);
    for (let index = 0; index < dots; index += 1) {
      const x = hash(index + time * 23.7) * width;
      const y = hash(index * 3.17 + time * 19.2) * height;
      const size = 1 + Math.floor(hash(index * 4.11 + time * 11.4) * 2);
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }
};

const drawBackground = (ctx, width, height, background, getImage) => {
  if (background.mode === 'solid') {
    ctx.fillStyle = background.colorA;
    ctx.fillRect(0, 0, width, height);
  } else if (background.mode === 'image' && background.imageSrc) {
    const image = getImage(background.imageSrc);
    if (image) {
      ctx.drawImage(image, 0, 0, width, height);
    } else {
      ctx.fillStyle = background.colorA;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const angle = (background.angle * Math.PI) / 180;
    const gradient = ctx.createLinearGradient(
      width / 2 - Math.cos(angle) * width * 0.6,
      height / 2 - Math.sin(angle) * height * 0.6,
      width / 2 + Math.cos(angle) * width * 0.6,
      height / 2 + Math.sin(angle) * height * 0.6,
    );
    gradient.addColorStop(0, background.colorA);
    gradient.addColorStop(0.52, background.colorB);
    gradient.addColorStop(1, background.colorC);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  if (background.vignette > 0) {
    const radial = ctx.createRadialGradient(width / 2, height / 2, width * 0.18, width / 2, height / 2, width * 0.74);
    radial.addColorStop(0, 'rgba(0,0,0,0)');
    radial.addColorStop(1, `rgba(0,0,0,${background.vignette})`);
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  }
};

export const renderScene = ({ ctx, width, height, scene, time, getImage }) => {
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, scene.background, getImage);

  scene.layers.forEach((layer) => {
    if (!layer.visible) {
      return;
    }

    const clip = getEnvelope(layer.timeline, time, scene.playback.duration);
    if (!clip.visible || clip.envelope <= 0) {
      return;
    }

    const seed = stringSeed(layer.id);
    const motionTime = clip.localTime;
    const x = modulate(layer.transform.x, layer.motion.x, motionTime, seed + 1);
    const y = modulate(layer.transform.y, layer.motion.y, motionTime, seed + 2);
    const scale = Math.max(0.05, modulate(layer.transform.scale, layer.motion.scale, motionTime, seed + 3));
    const rotation = modulate(layer.transform.rotation, layer.motion.rotation, motionTime, seed + 4);
    const opacity = clamp(modulate(layer.opacity, layer.motion.opacity, motionTime, seed + 5), 0, 1) * clip.envelope;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = layer.blendMode;
    ctx.filter = layer.blur > 0 ? `blur(${layer.blur}px)` : 'none';

    const state = { x, y, scale, rotation, time: motionTime };
    if (layer.kind === 'shape') {
      drawShapeLayer(ctx, layer, width, height, state);
    } else if (layer.kind === 'text') {
      drawTextLayer(ctx, layer, width, height, state);
    } else if (layer.kind === 'logo') {
      drawAssetLayer(ctx, layer, width, height, state, getImage(layer.assetSrc), layer.logo);
    } else if (layer.kind === 'image') {
      drawAssetLayer(ctx, layer, width, height, state, getImage(layer.assetSrc), layer.image);
    }

    ctx.restore();
  });

  applyPostEffects(ctx, width, height, scene.globalFx, time);
};
