export type CustomPinIconType = 'pin' | 'star' | 'flag' | 'target' | 'car' | 'skull';

export interface CustomMapPin {
  id: string;
  title: string;
  notes: string;
  lng: number;
  lat: number;
  color: string;
  iconType: CustomPinIconType;
  createdAt: string;
}

export const CUSTOM_PIN_COLORS = ['#FF4FD8', '#FFB458', '#22D3EE', '#A855F7', '#22C55E', '#EF4444'];

export const CUSTOM_PIN_ICONS: { type: CustomPinIconType; symbol: string; label: string }[] = [
  { type: 'pin', symbol: '📍', label: 'Pino' },
  { type: 'star', symbol: '⭐', label: 'Estrela' },
  { type: 'flag', symbol: '🚩', label: 'Bandeira' },
  { type: 'target', symbol: '🎯', label: 'Alvo' },
  { type: 'car', symbol: '🚗', label: 'Veículo' },
  { type: 'skull', symbol: '💀', label: 'Perigo' },
];

export interface CustomPinPopupCallbacks {
  onUpdate: (patch: Partial<Pick<CustomMapPin, 'title' | 'notes' | 'color' | 'iconType'>>) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Cria o botão de fechamento no estilo alvo de estande de tiro. */
export function createRangeTargetCloseButton(onHit: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Atirar no alvo para fechar';
  btn.setAttribute('aria-label', 'Atirar no alvo para fechar');
  btn.style.cssText =
    'position: relative; overflow: hidden; width: 28px; height: 28px; border-radius: 6px; background: rgba(239, 68, 68, 0.18); border: 1px solid rgba(239, 68, 68, 0.72); color: #EF4444; display: flex; align-items: center; justify-content: center; cursor: crosshair; padding: 0; outline: none; transition: background 110ms ease, box-shadow 110ms ease;';

  // Silhueta de estande de tiro em vermelho (gatilho visual de fechar) + âmbar Vice City
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
    <path d="M6 21v-4a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4" stroke="#FFB458"/>
    <circle cx="12" cy="8" r="5" stroke="#EF4444"/>
    <circle cx="12" cy="8" r="2.6" stroke="#FFB458"/>
    <circle cx="12" cy="8" r="1" fill="#EF4444"/>
  </svg>`;

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(239, 68, 68, 0.38)';
    btn.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.65)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(239, 68, 68, 0.18)';
    btn.style.boxShadow = '';
  });

  const holes: HTMLElement[] = [];

  btn.addEventListener('click', (e) => {
    e.stopPropagation();

    if (holes.length >= 3) {
      for (const h of holes) h.remove();
      holes.length = 0;
    }

    const rect = btn.getBoundingClientRect();
    const x = Math.max(3, Math.min(rect.width - 3, e.clientX - rect.left));
    const y = Math.max(3, Math.min(rect.height - 3, e.clientY - rect.top));

    const hole = document.createElement('span');
    hole.style.cssText = `position: absolute; left: ${x - 2.5}px; top: ${y - 2.5}px; width: 5px; height: 5px; border-radius: 50%; background: #09050f; box-shadow: 0 0 0 1px #FFB458; pointer-events: none;`;
    btn.appendChild(hole);
    holes.push(hole);

    btn.style.background = 'rgba(255, 180, 88, 0.28)';
    setTimeout(() => {
      btn.style.background = 'rgba(239, 68, 68, 0.18)';
      onHit();
    }, 110);
  });

  return btn;
}

/** Monta o conteúdo DOM do popup de marcação personalizada (temática Vice City / Leonida). */
export function createCustomPinPopupContent(
  pin: CustomMapPin,
  callbacks: CustomPinPopupCallbacks,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'leonida-pin-popup';
  container.style.cssText =
    'font-family: inherit; width: 224px; color: #f8fafc; background: rgba(18, 11, 30, 0.94); border: 1px solid rgba(255, 79, 216, 0.45); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65);';
  container.addEventListener('click', (e) => e.stopPropagation());

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 6px;';
  const label = document.createElement('span');
  label.textContent = 'MARCAÇÃO LEONIDA';
  label.style.cssText =
    'font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #FFB458; text-transform: uppercase;';
  header.append(label, createRangeTargetCloseButton(callbacks.onClose));

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = pin.title;
  titleInput.placeholder = 'Título do ponto';
  titleInput.style.cssText =
    'background: rgba(30, 16, 51, 0.9); color: #f8fafc; border: 1px solid rgba(255, 180, 88, 0.35); border-radius: 6px; padding: 5px 8px; font-size: 12px; font-weight: 600; width: 100%; box-sizing: border-box;';
  titleInput.addEventListener('input', () => callbacks.onUpdate({ title: titleInput.value }));

  const notesInput = document.createElement('textarea');
  notesInput.value = pin.notes ?? '';
  notesInput.rows = 2;
  notesInput.placeholder = 'Rascunho / observação...';
  notesInput.style.cssText =
    'background: rgba(30, 16, 51, 0.9); color: #e2e8f0; border: 1px solid rgba(255, 180, 88, 0.25); border-radius: 6px; padding: 5px 8px; font-size: 11px; resize: vertical; width: 100%; box-sizing: border-box;';
  notesInput.addEventListener('input', () => callbacks.onUpdate({ notes: notesInput.value }));

  const colorsRow = document.createElement('div');
  colorsRow.style.cssText = 'display: flex; gap: 6px; align-items: center;';
  for (const color of CUSTOM_PIN_COLORS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.title = color;
    swatch.style.cssText = `width: 18px; height: 18px; border-radius: 50%; background: ${color}; border: 2px solid #fff; cursor: pointer; padding: 0;`;
    swatch.addEventListener('click', () => callbacks.onUpdate({ color }));
    colorsRow.appendChild(swatch);
  }

  const iconsRow = document.createElement('div');
  iconsRow.style.cssText = 'display: flex; gap: 4px; align-items: center;';
  for (const ic of CUSTOM_PIN_ICONS) {
    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.title = ic.label;
    iconBtn.textContent = ic.symbol;
    iconBtn.style.cssText =
      'background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 6px; padding: 3px 6px; font-size: 13px; cursor: pointer;';
    iconBtn.addEventListener('click', () => callbacks.onUpdate({ iconType: ic.type }));
    iconsRow.appendChild(iconBtn);
  }

  const coordsRow = document.createElement('div');
  coordsRow.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; gap: 6px;';

  const coords = document.createElement('span');
  coords.className = 'leonida-pin-coords';
  coords.style.cssText = 'font-size: 10px; opacity: 0.78; font-variant-numeric: tabular-nums;';
  coords.textContent = `${pin.lng.toFixed(3)}, ${pin.lat.toFixed(3)}`;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'leonida-pin-copy-btn';
  copyBtn.title = 'Copiar localização (K)';
  copyBtn.setAttribute('aria-label', 'Copiar localização');
  copyBtn.style.cssText =
    'display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 5px; border: 1px solid rgba(76, 224, 210, 0.45); background: rgba(76, 224, 210, 0.12); color: #4CE0D2; font-size: 10px; font-weight: 700; cursor: pointer;';

  const copyIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const checkIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  const kbdHtml = `<kbd style="padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(76, 224, 210, 0.45); background: rgba(18, 11, 30, 0.8); font-size: 9px; font-family: inherit;">K</kbd>`;

  copyBtn.innerHTML = `${copyIconSvg}${kbdHtml}`;

  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const text = coords.textContent ?? '';
    void copyTextToClipboard(text);
    copyBtn.classList.add('is-copied');
    copyBtn.innerHTML = `${checkIconSvg}<span>Copiado</span>`;
    if (resetTimer !== null) {
      clearTimeout(resetTimer);
    }
    resetTimer = setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyBtn.innerHTML = `${copyIconSvg}${kbdHtml}`;
    }, 1500);
  });

  coordsRow.append(coords, copyBtn);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remover ponto';
  removeBtn.style.cssText =
    'background: linear-gradient(135deg, #FF4FD8, #EF4444); color: #fff; border: none; border-radius: 6px; padding: 6px 8px; font-size: 11px; font-weight: 700; cursor: pointer; width: 100%;';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    callbacks.onRemove();
  });

  container.append(header, titleInput, notesInput, colorsRow, iconsRow, coordsRow, removeBtn);
  return container;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for non-secure HTTP origins (e.g. LAN IP)
    }
  }
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }
  const prevFocused = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText =
    'position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    prevFocused?.focus?.({ preventScroll: true });
  }
  return copied;
}
