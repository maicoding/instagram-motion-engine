import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid2x2,
  ImagePlus,
  Layers,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  ARRANGEMENTS,
  BLEND_MODES,
  BUILT_IN_LOGOS,
  CANVAS_PRESETS,
  GOOGLE_FONTS,
  LOOP_OPTIONS,
  SHAPE_PRESETS,
  WAVE_OPTIONS,
  createImageLayer,
  createInitialScene,
  createLogoLayer,
  createShapeLayer,
  createTextLayer,
} from './presets.js';
import { renderScene } from './engine.js';

const deepSet = (source, path, value) => {
  const keys = path.split('.');
  const clone = Array.isArray(source) ? [...source] : { ...source };
  let cursor = clone;
  let original = source;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    cursor[key] = Array.isArray(original[key]) ? [...original[key]] : { ...original[key] };
    cursor = cursor[key];
    original = original[key];
  });
  return clone;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const useElementSize = (ref) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};

const SliderField = ({ label, value, min, max, step = 0.01, onChange, format }) => (
  <label className="field">
    <div className="field__head">
      <span>{label}</span>
      <span>{format ? format(value) : value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const SelectField = ({ label, value, options, onChange }) => (
  <label className="field">
    <div className="field__head">
      <span>{label}</span>
    </div>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value ?? option} value={option.value ?? option}>
          {option.label ?? option}
        </option>
      ))}
    </select>
  </label>
);

const ColorField = ({ label, value, onChange }) => (
  <label className="field">
    <div className="field__head">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const Section = ({ title, icon: Icon, children }) => (
  <section className="panel">
    <div className="panel__title">
      <Icon size={15} />
      <span>{title}</span>
    </div>
    <div className="panel__body">{children}</div>
  </section>
);

const UploadButton = ({ label, accept, onSelect }) => {
  const inputRef = useRef(null);

  return (
    <div className="upload-tile">
      <button className="ghost-button upload-button" type="button" onClick={() => inputRef.current?.click()}>
        <Upload size={16} />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onSelect(event)}
      />
    </div>
  );
};

const App = () => {
  const initialScene = useMemo(() => createInitialScene(), []);
  const [scene, setScene] = useState(initialScene);
  const [activeLayerId, setActiveLayerId] = useState(initialScene.layers[0]?.id ?? null);
  const [logoLibrary, setLogoLibrary] = useState(BUILT_IN_LOGOS);
  const [assetVersion, setAssetVersion] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const imageCacheRef = useRef(new Map());
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const stageSize = useElementSize(stageRef);
  const lastTickRef = useRef(0);

  const preset = CANVAS_PRESETS.find((item) => item.id === scene.presetId) ?? CANVAS_PRESETS[0];
  const activeLayer = scene.layers.find((layer) => layer.id === activeLayerId) ?? scene.layers[0] ?? null;

  const getImage = (src) => {
    if (!src) {
      return null;
    }
    const cached = imageCacheRef.current.get(src);
    if (cached?.status === 'loaded') {
      return cached.image;
    }
    if (cached?.status === 'loading') {
      return null;
    }
    const image = new Image();
    image.onload = () => {
      imageCacheRef.current.set(src, { status: 'loaded', image });
      setAssetVersion((version) => version + 1);
    };
    image.onerror = () => imageCacheRef.current.set(src, { status: 'error', image: null });
    image.src = src;
    imageCacheRef.current.set(src, { status: 'loading', image: null });
    return null;
  };

  const previewScale = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return 0.3 * previewZoom;
    }
    const margin = 96;
    return Math.min(
      (stageSize.width - margin) / preset.width,
      (stageSize.height - 160) / preset.height,
      1,
    ) * previewZoom;
  }, [preset.height, preset.width, previewZoom, stageSize.height, stageSize.width]);

  const updateScene = (path, value) => setScene((current) => deepSet(current, path, value));

  const updateLayer = (layerId, path, value) => {
    setScene((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === layerId ? deepSet(layer, path, value) : layer)),
    }));
  };

  const replaceLayer = (layerId, updater) => {
    setScene((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === layerId ? updater(layer) : layer)),
    }));
  };

  const moveLayer = (layerId, direction) => {
    setScene((current) => {
      const index = current.layers.findIndex((layer) => layer.id === layerId);
      if (index < 0) {
        return current;
      }
      const nextIndex = clamp(index + direction, 0, current.layers.length - 1);
      if (nextIndex === index) {
        return current;
      }
      const layers = [...current.layers];
      const [item] = layers.splice(index, 1);
      layers.splice(nextIndex, 0, item);
      return { ...current, layers };
    });
  };

  const addLayer = (kind) => {
    const maker =
      kind === 'shape'
        ? createShapeLayer
        : kind === 'text'
          ? createTextLayer
          : kind === 'logo'
            ? createLogoLayer
            : createImageLayer;
    setScene((current) => {
      const layer = maker(current.layers.filter((item) => item.kind === kind).length + 1);
      setActiveLayerId(layer.id);
      return { ...current, layers: [...current.layers, layer] };
    });
  };

  const applyLogoPresetToLayer = (layerId, entry) => {
    replaceLayer(layerId, (layer) => {
      if (layer.kind !== 'logo') {
        return layer;
      }
      return {
        ...layer,
        assetSrc: entry.src,
        assetName: entry.name,
        logo: {
          ...layer.logo,
          ...(entry.defaults ?? {}),
        },
      };
    });
  };

  const applyLogoEntry = (entry) => {
    if (activeLayer?.kind === 'logo') {
      applyLogoPresetToLayer(activeLayer.id, entry);
      return;
    }

    setScene((current) => {
      const freshLayer = createLogoLayer(current.layers.filter((item) => item.kind === 'logo').length + 1);
      const nextLayer = {
        ...freshLayer,
        assetSrc: entry.src,
        assetName: entry.name,
        logo: {
          ...freshLayer.logo,
          ...(entry.defaults ?? {}),
        },
      };
      setActiveLayerId(nextLayer.id);
      return { ...current, layers: [...current.layers, nextLayer] };
    });
  };

  const duplicateLayer = (layerId) => {
    setScene((current) => {
      const target = current.layers.find((layer) => layer.id === layerId);
      if (!target) {
        return current;
      }
      const duplicate = {
        ...target,
        id: `${target.kind}_${Math.random().toString(36).slice(2, 9)}`,
        name: `${target.name} Copy`,
      };
      setActiveLayerId(duplicate.id);
      return { ...current, layers: [...current.layers, duplicate] };
    });
  };

  const deleteLayer = (layerId) => {
    setScene((current) => {
      const remaining = current.layers.filter((layer) => layer.id !== layerId);
      const nextActive = remaining[Math.max(0, remaining.length - 1)]?.id ?? null;
      setActiveLayerId(nextActive);
      return { ...current, layers: remaining };
    });
  };

  const randomizeActiveLayer = () => {
    if (!activeLayer) {
      return;
    }
    replaceLayer(activeLayer.id, (layer) => ({
      ...layer,
      transform: {
        ...layer.transform,
        rotation: Math.round(Math.random() * 25 - 12),
      },
      motion: {
        ...layer.motion,
        x: { ...layer.motion.x, amp: Number((Math.random() * 0.08).toFixed(3)), freq: Number((0.04 + Math.random() * 0.3).toFixed(2)) },
        y: { ...layer.motion.y, amp: Number((Math.random() * 0.08).toFixed(3)), freq: Number((0.04 + Math.random() * 0.25).toFixed(2)) },
        scale: { ...layer.motion.scale, amp: Number((0.02 + Math.random() * 0.18).toFixed(3)), freq: Number((0.06 + Math.random() * 0.28).toFixed(2)) },
        rotation: { ...layer.motion.rotation, amp: Number((2 + Math.random() * 32).toFixed(1)), freq: Number((0.02 + Math.random() * 0.18).toFixed(2)) },
      },
      fx: {
        ...layer.fx,
        glitch: Number((Math.random() * 0.35).toFixed(2)),
        jitter: Number((Math.random() * 0.02).toFixed(3)),
      },
    }));
  };

  const handleAssetUpload = (event, callback) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const src = URL.createObjectURL(file);
    callback({ file, src });
    event.target.value = '';
  };

  const exportFrame = (type) => {
    const canvas = document.createElement('canvas');
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext('2d');
    renderScene({
      ctx,
      width: preset.width,
      height: preset.height,
      scene,
      time: scene.playback.time,
      getImage,
    });
    const link = document.createElement('a');
    link.download = `instagram-motion-frame-${Date.now()}.${type === 'jpeg' ? 'jpg' : 'png'}`;
    link.href = canvas.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
    link.click();
  };

  const exportSceneJson = () => {
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `instagram-motion-scene-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!scene.playback.playing) {
      lastTickRef.current = 0;
      return undefined;
    }

    let frameId = 0;
    const frameDuration = 1000 / Math.max(1, scene.playback.fps);

    const tick = (timestamp) => {
      if (!lastTickRef.current) {
        lastTickRef.current = timestamp;
      }
      const delta = timestamp - lastTickRef.current;
      if (delta >= frameDuration) {
        setScene((current) => {
          const nextTime = current.playback.time + (delta / 1000) * current.playback.rate;
          const duration = current.playback.duration;
          const wrapped = current.playback.loop ? nextTime % duration : Math.min(duration, nextTime);
          const shouldStop = !current.playback.loop && nextTime >= duration;
          return {
            ...current,
            playback: {
              ...current.playback,
              time: wrapped,
              playing: shouldStop ? false : current.playback.playing,
            },
          };
        });
        lastTickRef.current = timestamp;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [scene.playback.fps, scene.playback.loop, scene.playback.playing, scene.playback.rate]);

  useEffect(() => {
    setScene((current) => ({
      ...current,
      playback: {
        ...current.playback,
        time: Math.min(current.playback.time, current.playback.duration),
      },
      layers: current.layers.map((layer) => ({
        ...layer,
        timeline: {
          ...layer.timeline,
          inPoint: Math.min(layer.timeline.inPoint, Math.max(0, current.playback.duration - 0.1)),
          outPoint: Math.min(Math.max(layer.timeline.outPoint, layer.timeline.inPoint + 0.1), current.playback.duration),
        },
      })),
    }));
  }, [scene.playback.duration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    renderScene({
      ctx,
      width: preset.width,
      height: preset.height,
      scene,
      time: scene.playback.time,
      getImage,
    });
  }, [assetVersion, preset.height, preset.width, scene]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__header">
          <div>
            <div className="eyebrow">Touch Style Motion Lab</div>
            <h1>Instagram Motion Engine</h1>
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              const freshScene = createInitialScene();
              setScene(freshScene);
              setActiveLayerId(freshScene.layers[0]?.id ?? null);
            }}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <Section title="Composition & Timeline" icon={Activity}>
          <SelectField
            label="Format"
            value={scene.presetId}
            options={CANVAS_PRESETS.map((item) => ({ value: item.id, label: `${item.label} (${item.width}x${item.height})` }))}
            onChange={(value) => updateScene('presetId', value)}
          />
          <div className="field-grid">
            <SliderField label="Dauer" value={scene.playback.duration} min={2} max={20} step={0.5} format={(value) => `${value.toFixed(1)}s`} onChange={(value) => updateScene('playback.duration', value)} />
            <SliderField label="FPS" value={scene.playback.fps} min={12} max={60} step={1} format={(value) => `${value}`} onChange={(value) => updateScene('playback.fps', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Tempo" value={scene.playback.rate} min={0.2} max={3} step={0.05} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateScene('playback.rate', value)} />
            <label className="toggle">
              <span>Loop</span>
              <input type="checkbox" checked={scene.playback.loop} onChange={(event) => updateScene('playback.loop', event.target.checked)} />
            </label>
          </div>
          <SliderField
            label="Playhead"
            value={scene.playback.time}
            min={0}
            max={scene.playback.duration}
            step={0.01}
            format={(value) => `${value.toFixed(2)}s`}
            onChange={(value) => updateScene('playback.time', value)}
          />
        </Section>

        <Section title="Background & Global FX" icon={Sparkles}>
          <div className="mode-row">
            {[
              { value: 'gradient', label: 'Gradient' },
              { value: 'solid', label: 'Solid' },
              { value: 'image', label: 'Image' },
            ].map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={`mode-chip ${scene.background.mode === mode.value ? 'is-active' : ''}`}
                onClick={() => updateScene('background.mode', mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <ColorField label="Color A" value={scene.background.colorA} onChange={(value) => updateScene('background.colorA', value)} />
            <ColorField label="Color B" value={scene.background.colorB} onChange={(value) => updateScene('background.colorB', value)} />
          </div>
          <div className="field-grid">
            <ColorField label="Color C" value={scene.background.colorC} onChange={(value) => updateScene('background.colorC', value)} />
            <SliderField label="Angle" value={scene.background.angle} min={0} max={360} step={1} format={(value) => `${Math.round(value)}°`} onChange={(value) => updateScene('background.angle', value)} />
          </div>
          <div className="background-preview" style={{ background: `linear-gradient(${scene.background.angle}deg, ${scene.background.colorA} 0%, ${scene.background.colorB} 55%, ${scene.background.colorC} 100%)` }} />
          <UploadButton
            label={scene.background.imageSrc ? 'Background austauschen' : 'Background laden'}
            accept="image/*"
            onSelect={(event) =>
              handleAssetUpload(event, ({ src }) => {
                updateScene('background.imageSrc', src);
                updateScene('background.mode', 'image');
              })
            }
          />
          {scene.background.imageSrc && <div className="asset-note">Image-Background geladen</div>}
          <SliderField label="Vignette" value={scene.background.vignette} min={0} max={0.7} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('background.vignette', value)} />
          <div className="field-grid">
            <SliderField label="Scanlines" value={scene.globalFx.scanlines} min={0} max={0.6} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('globalFx.scanlines', value)} />
            <SliderField label="Noise" value={scene.globalFx.noise} min={0} max={0.4} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('globalFx.noise', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Displace" value={scene.globalFx.displacement} min={0} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('globalFx.displacement', value)} />
            <SliderField label="Chromatic" value={scene.globalFx.chromatic} min={0} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('globalFx.chromatic', value)} />
          </div>
          <SliderField label="Ghost" value={scene.globalFx.ghost} min={0} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('globalFx.ghost', value)} />
        </Section>

        <Section title="Logo Library" icon={ImagePlus}>
          <div className="library-grid">
            {logoLibrary.map((logo) => (
              <button
                key={logo.id}
                className={`library-card ${activeLayer?.assetSrc === logo.src ? 'is-active' : ''}`}
                onClick={() => applyLogoEntry(logo)}
              >
                <img src={logo.src} alt={logo.name} />
                <span>{logo.name}</span>
              </button>
            ))}
          </div>
          <UploadButton
            label="Weiteres Logo einbauen"
            accept="image/*,.svg"
            onSelect={(event) =>
              handleAssetUpload(event, ({ file, src }) => {
                const entry = {
                  id: `logo_${Math.random().toString(36).slice(2, 9)}`,
                  name: file.name.replace(/\.[^.]+$/, ''),
                  src,
                  defaults: {
                    preserveColor: false,
                    tint: '#ffffff',
                    removeWhite: true,
                    whiteThreshold: 238,
                    size: 0.2,
                    stretchX: 1,
                    stretchY: 1,
                  },
                };
                setLogoLibrary((current) => [...current, entry]);
                applyLogoEntry(entry);
              })
            }
          />
        </Section>

        <Section title="Layer Stack" icon={Layers}>
          <div className="button-row">
            <button className="accent-button" onClick={() => addLayer('shape')}>
              <Plus size={15} />
              Shape
            </button>
            <button className="accent-button" onClick={() => addLayer('text')}>
              <Plus size={15} />
              Text
            </button>
            <button className="accent-button" onClick={() => addLayer('logo')}>
              <Plus size={15} />
              Logo
            </button>
            <button className="accent-button" onClick={() => addLayer('image')}>
              <Plus size={15} />
              Image
            </button>
          </div>

          <div className="layer-list">
            {scene.layers.map((layer, index) => (
              <button
                key={layer.id}
                className={`layer-item ${activeLayerId === layer.id ? 'is-active' : ''}`}
                onClick={() => setActiveLayerId(layer.id)}
              >
                <div className="layer-item__meta">
                  <span className="layer-kind">{layer.kind}</span>
                  <strong>{layer.name}</strong>
                  <small>Stack {index + 1}</small>
                </div>
                <div className="layer-item__actions">
                  <span
                    className="icon-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateLayer(layer.id, 'visible', !layer.visible);
                    }}
                  >
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {activeLayer && (
          <>
            <Section title={`Active Layer: ${activeLayer.name}`} icon={SlidersHorizontal}>
              <div className="button-row">
                <button className="ghost-button" onClick={() => moveLayer(activeLayer.id, 1)}>Vor</button>
                <button className="ghost-button" onClick={() => moveLayer(activeLayer.id, -1)}>Zurueck</button>
                <button className="ghost-button" onClick={() => duplicateLayer(activeLayer.id)}>
                  <Copy size={14} />
                  Duplizieren
                </button>
                <button className="ghost-button danger" onClick={() => deleteLayer(activeLayer.id)}>Loeschen</button>
              </div>
              <div className="field-grid">
                <SliderField label="X" value={activeLayer.transform.x} min={0} max={1} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'transform.x', value)} />
                <SliderField label="Y" value={activeLayer.transform.y} min={0} max={1} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'transform.y', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Scale" value={activeLayer.transform.scale} min={0.2} max={2.5} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateLayer(activeLayer.id, 'transform.scale', value)} />
                <SliderField label="Rotation" value={activeLayer.transform.rotation} min={-180} max={180} step={1} format={(value) => `${Math.round(value)}°`} onChange={(value) => updateLayer(activeLayer.id, 'transform.rotation', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Opacity" value={activeLayer.opacity} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'opacity', value)} />
                <SliderField label="Blur" value={activeLayer.blur} min={0} max={24} step={0.5} format={(value) => `${value.toFixed(1)}px`} onChange={(value) => updateLayer(activeLayer.id, 'blur', value)} />
              </div>
              <SelectField label="Blend" value={activeLayer.blendMode} options={BLEND_MODES} onChange={(value) => updateLayer(activeLayer.id, 'blendMode', value)} />
            </Section>

            <Section title="Layer Timeline" icon={Activity}>
              <div className="field-grid">
                <SliderField label="In" value={activeLayer.timeline.inPoint} min={0} max={scene.playback.duration - 0.1} step={0.05} format={(value) => `${value.toFixed(2)}s`} onChange={(value) => updateLayer(activeLayer.id, 'timeline.inPoint', value)} />
                <SliderField label="Out" value={activeLayer.timeline.outPoint} min={0.1} max={scene.playback.duration} step={0.05} format={(value) => `${value.toFixed(2)}s`} onChange={(value) => updateLayer(activeLayer.id, 'timeline.outPoint', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Fade In" value={activeLayer.timeline.fadeIn} min={0} max={3} step={0.05} format={(value) => `${value.toFixed(2)}s`} onChange={(value) => updateLayer(activeLayer.id, 'timeline.fadeIn', value)} />
                <SliderField label="Fade Out" value={activeLayer.timeline.fadeOut} min={0} max={3} step={0.05} format={(value) => `${value.toFixed(2)}s`} onChange={(value) => updateLayer(activeLayer.id, 'timeline.fadeOut', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Speed" value={activeLayer.timeline.speed} min={0.2} max={3} step={0.05} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateLayer(activeLayer.id, 'timeline.speed', value)} />
                <SelectField label="Loop Mode" value={activeLayer.timeline.loopMode} options={LOOP_OPTIONS} onChange={(value) => updateLayer(activeLayer.id, 'timeline.loopMode', value)} />
              </div>
            </Section>

            <Section title="Motion Modulators" icon={Wand2}>
              <div className="button-row">
                <button className="ghost-button" onClick={randomizeActiveLayer}>
                  <Sparkles size={14} />
                  Randomize
                </button>
              </div>
              {['x', 'y', 'scale', 'rotation', 'opacity'].map((channel) => (
                <div key={channel} className="mod-card">
                  <div className="mod-card__title">{channel.toUpperCase()}</div>
                  <div className="field-grid">
                    <SelectField label="Wave" value={activeLayer.motion[channel].wave} options={WAVE_OPTIONS} onChange={(value) => updateLayer(activeLayer.id, `motion.${channel}.wave`, value)} />
                    <SliderField label="Amp" value={activeLayer.motion[channel].amp} min={channel === 'rotation' ? 0 : 0} max={channel === 'rotation' ? 60 : channel === 'opacity' ? 0.5 : 0.25} step={channel === 'rotation' ? 0.5 : 0.005} format={(value) => channel === 'rotation' ? `${value.toFixed(1)}°` : `${value.toFixed(3)}`} onChange={(value) => updateLayer(activeLayer.id, `motion.${channel}.amp`, value)} />
                  </div>
                  <div className="field-grid">
                    <SliderField label="Freq" value={activeLayer.motion[channel].freq} min={0.01} max={2} step={0.01} format={(value) => `${value.toFixed(2)}hz`} onChange={(value) => updateLayer(activeLayer.id, `motion.${channel}.freq`, value)} />
                    <SliderField label="Phase" value={activeLayer.motion[channel].phase} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onChange={(value) => updateLayer(activeLayer.id, `motion.${channel}.phase`, value)} />
                  </div>
                  <SliderField label="Noise" value={activeLayer.motion[channel].noise} min={0} max={channel === 'rotation' ? 12 : 0.08} step={channel === 'rotation' ? 0.1 : 0.002} format={(value) => channel === 'rotation' ? `${value.toFixed(1)}°` : value.toFixed(3)} onChange={(value) => updateLayer(activeLayer.id, `motion.${channel}.noise`, value)} />
                </div>
              ))}
              <div className="field-grid">
                <SliderField label="Jitter" value={activeLayer.fx.jitter} min={0} max={0.03} step={0.001} format={(value) => value.toFixed(3)} onChange={(value) => updateLayer(activeLayer.id, 'fx.jitter', value)} />
                <SliderField label="Glitch" value={activeLayer.fx.glitch} min={0} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'fx.glitch', value)} />
              </div>
            </Section>

            {activeLayer.kind === 'shape' && (
              <Section title="Shape Settings" icon={Layers}>
                <div className="field-grid">
                  <SelectField label="Preset" value={activeLayer.shape.preset} options={SHAPE_PRESETS} onChange={(value) => updateLayer(activeLayer.id, 'shape.preset', value)} />
                  <SelectField label="Arrangement" value={activeLayer.shape.arrangement} options={ARRANGEMENTS} onChange={(value) => updateLayer(activeLayer.id, 'shape.arrangement', value)} />
                </div>
                <div className="field-grid">
                  <ColorField label="Fill" value={activeLayer.shape.fill} onChange={(value) => updateLayer(activeLayer.id, 'shape.fill', value)} />
                  <ColorField label="Stroke" value={activeLayer.shape.stroke} onChange={(value) => updateLayer(activeLayer.id, 'shape.stroke', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Instances" value={activeLayer.shape.instances} min={1} max={16} step={1} format={(value) => `${value}`} onChange={(value) => updateLayer(activeLayer.id, 'shape.instances', value)} />
                  <SliderField label="Size" value={activeLayer.shape.size} min={0.05} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'shape.size', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Spread" value={activeLayer.shape.spread} min={0} max={0.8} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'shape.spread', value)} />
                  <SliderField label="Distortion" value={activeLayer.shape.distortion} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'shape.distortion', value)} />
                </div>
                <SliderField label="Stroke Width" value={activeLayer.shape.lineWidth} min={0} max={12} step={0.5} format={(value) => `${value.toFixed(1)}px`} onChange={(value) => updateLayer(activeLayer.id, 'shape.lineWidth', value)} />
              </Section>
            )}

            {activeLayer.kind === 'text' && (
              <Section title="Text Settings" icon={Type}>
                <label className="field">
                  <div className="field__head">
                    <span>Text</span>
                  </div>
                  <textarea value={activeLayer.text.value} onChange={(event) => updateLayer(activeLayer.id, 'text.value', event.target.value)} />
                </label>
                <div className="field-grid">
                  <SelectField label="Font" value={activeLayer.text.font} options={GOOGLE_FONTS} onChange={(value) => updateLayer(activeLayer.id, 'text.font', value)} />
                  <SelectField label="Layout" value={activeLayer.text.layout} options={ARRANGEMENTS} onChange={(value) => updateLayer(activeLayer.id, 'text.layout', value)} />
                </div>
                <div className="field-grid">
                  <ColorField label="Color" value={activeLayer.text.color} onChange={(value) => updateLayer(activeLayer.id, 'text.color', value)} />
                  <SliderField label="Weight" value={activeLayer.text.weight} min={200} max={900} step={100} format={(value) => `${value}`} onChange={(value) => updateLayer(activeLayer.id, 'text.weight', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Size" value={activeLayer.text.size} min={24} max={260} step={1} format={(value) => `${value}px`} onChange={(value) => updateLayer(activeLayer.id, 'text.size', value)} />
                  <SliderField label="Tracking" value={activeLayer.text.tracking} min={-6} max={40} step={1} format={(value) => `${value}px`} onChange={(value) => updateLayer(activeLayer.id, 'text.tracking', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Leading" value={activeLayer.text.leading} min={0.6} max={1.8} step={0.01} format={(value) => value.toFixed(2)} onChange={(value) => updateLayer(activeLayer.id, 'text.leading', value)} />
                  <SliderField label="Outline" value={activeLayer.text.outline} min={0} max={10} step={0.5} format={(value) => `${value.toFixed(1)}px`} onChange={(value) => updateLayer(activeLayer.id, 'text.outline', value)} />
                </div>
                {activeLayer.text.layout !== 'single' && (
                  <div className="field-grid">
                    <SliderField label="Instances" value={activeLayer.text.instances} min={1} max={16} step={1} format={(value) => `${value}`} onChange={(value) => updateLayer(activeLayer.id, 'text.instances', value)} />
                    <SliderField label="Spread" value={activeLayer.text.spread} min={0} max={0.8} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'text.spread', value)} />
                  </div>
                )}
              </Section>
            )}

            {activeLayer.kind === 'logo' && (
              <Section title="Logo Settings" icon={ImagePlus}>
                <SelectField
                  label="Logo"
                  value={activeLayer.assetSrc}
                  options={logoLibrary.map((logo) => ({ value: logo.src, label: logo.name }))}
                  onChange={(value) => {
                    const entry = logoLibrary.find((logo) => logo.src === value);
                    if (entry) {
                      applyLogoPresetToLayer(activeLayer.id, entry);
                    }
                  }}
                />
                <div className="asset-note">{activeLayer.assetName || 'Kein Logo aktiv'}</div>
                <div className="field-grid">
                  <ColorField label="Tint" value={activeLayer.logo.tint} onChange={(value) => updateLayer(activeLayer.id, 'logo.tint', value)} />
                  <label className="toggle">
                    <span>Originalfarben</span>
                    <input type="checkbox" checked={activeLayer.logo.preserveColor} onChange={(event) => updateLayer(activeLayer.id, 'logo.preserveColor', event.target.checked)} />
                  </label>
                </div>
                <div className="field-grid">
                  <label className="toggle">
                    <span>Weiss freistellen</span>
                    <input type="checkbox" checked={activeLayer.logo.removeWhite} onChange={(event) => updateLayer(activeLayer.id, 'logo.removeWhite', event.target.checked)} />
                  </label>
                  <SliderField label="Threshold" value={activeLayer.logo.whiteThreshold} min={180} max={250} step={1} format={(value) => `${value}`} onChange={(value) => updateLayer(activeLayer.id, 'logo.whiteThreshold', value)} />
                </div>
                <div className="field-grid">
                  <SelectField label="Arrangement" value={activeLayer.logo.arrangement} options={ARRANGEMENTS} onChange={(value) => updateLayer(activeLayer.id, 'logo.arrangement', value)} />
                  <SliderField label="Instances" value={activeLayer.logo.instances} min={1} max={12} step={1} format={(value) => `${value}`} onChange={(value) => updateLayer(activeLayer.id, 'logo.instances', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Size" value={activeLayer.logo.size} min={0.05} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'logo.size', value)} />
                  <SliderField label="Spread" value={activeLayer.logo.spread} min={0} max={0.8} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'logo.spread', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Stretch X" value={activeLayer.logo.stretchX} min={0.35} max={2.5} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateLayer(activeLayer.id, 'logo.stretchX', value)} />
                  <SliderField label="Stretch Y" value={activeLayer.logo.stretchY} min={0.35} max={2.5} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateLayer(activeLayer.id, 'logo.stretchY', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Pulse X" value={activeLayer.logo.pulseX} min={0} max={0.8} step={0.01} format={(value) => `${value.toFixed(2)}`} onChange={(value) => updateLayer(activeLayer.id, 'logo.pulseX', value)} />
                  <SliderField label="Pulse Y" value={activeLayer.logo.pulseY} min={0} max={0.8} step={0.01} format={(value) => `${value.toFixed(2)}`} onChange={(value) => updateLayer(activeLayer.id, 'logo.pulseY', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Pulse Speed" value={activeLayer.logo.pulseSpeed} min={0.01} max={1.5} step={0.01} format={(value) => `${value.toFixed(2)}hz`} onChange={(value) => updateLayer(activeLayer.id, 'logo.pulseSpeed', value)} />
                  <SliderField label="Color Drift" value={activeLayer.logo.colorDrift} min={0} max={180} step={1} format={(value) => `${Math.round(value)}°`} onChange={(value) => updateLayer(activeLayer.id, 'logo.colorDrift', value)} />
                </div>
                <SliderField label="Color Speed" value={activeLayer.logo.colorSpeed} min={0.01} max={1.5} step={0.01} format={(value) => `${value.toFixed(2)}hz`} onChange={(value) => updateLayer(activeLayer.id, 'logo.colorSpeed', value)} />
              </Section>
            )}

            {activeLayer.kind === 'image' && (
              <Section title="Image Settings" icon={ImagePlus}>
                <UploadButton
                  label={activeLayer.assetSrc ? 'Bild austauschen' : 'Bild hochladen'}
                  accept="image/*"
                  onSelect={(event) =>
                    handleAssetUpload(event, ({ file, src }) => {
                      updateLayer(activeLayer.id, 'assetSrc', src);
                      updateLayer(activeLayer.id, 'assetName', file.name);
                    })
                  }
                />
                <div className="asset-note">{activeLayer.assetName || 'Kein Bild aktiv'}</div>
                <div className="field-grid">
                  <ColorField label="Tint" value={activeLayer.image.tint} onChange={(value) => updateLayer(activeLayer.id, 'image.tint', value)} />
                  <label className="toggle">
                    <span>Originalfarben</span>
                    <input type="checkbox" checked={activeLayer.image.preserveColor} onChange={(event) => updateLayer(activeLayer.id, 'image.preserveColor', event.target.checked)} />
                  </label>
                </div>
                <div className="field-grid">
                  <label className="toggle">
                    <span>Weiss freistellen</span>
                    <input type="checkbox" checked={activeLayer.image.removeWhite} onChange={(event) => updateLayer(activeLayer.id, 'image.removeWhite', event.target.checked)} />
                  </label>
                  <SliderField label="Threshold" value={activeLayer.image.whiteThreshold} min={180} max={250} step={1} format={(value) => `${value}`} onChange={(value) => updateLayer(activeLayer.id, 'image.whiteThreshold', value)} />
                </div>
                <div className="field-grid">
                  <SelectField label="Arrangement" value={activeLayer.image.arrangement} options={ARRANGEMENTS} onChange={(value) => updateLayer(activeLayer.id, 'image.arrangement', value)} />
                  <SliderField label="Instances" value={activeLayer.image.instances} min={1} max={12} step={1} format={(value) => `${value}`} onChange={(value) => updateLayer(activeLayer.id, 'image.instances', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Size" value={activeLayer.image.size} min={0.05} max={0.6} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'image.size', value)} />
                  <SliderField label="Spread" value={activeLayer.image.spread} min={0} max={0.8} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateLayer(activeLayer.id, 'image.spread', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Stretch X" value={activeLayer.image.stretchX} min={0.35} max={2.5} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateLayer(activeLayer.id, 'image.stretchX', value)} />
                  <SliderField label="Stretch Y" value={activeLayer.image.stretchY} min={0.35} max={2.5} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateLayer(activeLayer.id, 'image.stretchY', value)} />
                </div>
                <div className="field-grid">
                  <SliderField label="Pulse X" value={activeLayer.image.pulseX} min={0} max={0.8} step={0.01} format={(value) => `${value.toFixed(2)}`} onChange={(value) => updateLayer(activeLayer.id, 'image.pulseX', value)} />
                  <SliderField label="Pulse Y" value={activeLayer.image.pulseY} min={0} max={0.8} step={0.01} format={(value) => `${value.toFixed(2)}`} onChange={(value) => updateLayer(activeLayer.id, 'image.pulseY', value)} />
                </div>
                <SliderField label="Pulse Speed" value={activeLayer.image.pulseSpeed} min={0.01} max={1.5} step={0.01} format={(value) => `${value.toFixed(2)}hz`} onChange={(value) => updateLayer(activeLayer.id, 'image.pulseSpeed', value)} />
              </Section>
            )}
          </>
        )}
      </aside>

      <main className="workspace">
        <header className="workspace__header">
          <div className="workspace__stats">
            <span>{preset.label}</span>
            <span>{preset.width} x {preset.height}</span>
            <span>{scene.layers.length} Layer</span>
          </div>
          <div className="button-row">
            <button className="ghost-button" onClick={() => updateScene('guides.grid', !scene.guides.grid)}>
              <Grid2x2 size={15} />
              Grid
            </button>
            <label className="zoom-control">
              <span>Zoom</span>
              <input type="range" min="0.5" max="1.8" step="0.01" value={previewZoom} onChange={(event) => setPreviewZoom(Number(event.target.value))} />
            </label>
            <button className="ghost-button" onClick={() => exportFrame('png')}>
              <Download size={15} />
              PNG
            </button>
            <button className="ghost-button" onClick={() => exportFrame('jpeg')}>JPG</button>
            <button className="ghost-button" onClick={exportSceneJson}>Scene JSON</button>
          </div>
        </header>

        <div className="stage" ref={stageRef}>
          <div
            className="stage__frame"
            style={{
              width: `${preset.width * previewScale}px`,
              height: `${preset.height * previewScale}px`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={preset.width}
              height={preset.height}
              style={{
                width: `${preset.width * previewScale}px`,
                height: `${preset.height * previewScale}px`,
              }}
            />

            {scene.guides.grid && (
              <div className="grid-overlay">
                <div className="grid-overlay__safe" />
              </div>
            )}
          </div>
        </div>

        <footer className="timeline-bar">
          <div className="button-row">
            <button className="transport-button" onClick={() => updateScene('playback.playing', !scene.playback.playing)}>
              {scene.playback.playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button className="transport-button" onClick={() => updateScene('playback.time', 0)}>
              <RotateCcw size={16} />
            </button>
          </div>
          <input
            className="timeline-slider"
            type="range"
            min="0"
            max={scene.playback.duration}
            step="0.01"
            value={scene.playback.time}
            onChange={(event) => updateScene('playback.time', Number(event.target.value))}
          />
          <div className="timeline-bar__meta">
            <span>{scene.playback.time.toFixed(2)}s</span>
            <span>{scene.playback.duration.toFixed(2)}s</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
