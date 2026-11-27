import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  Box,
  EyeOff,
  Layers,
  LocateFixed,
  MapPin,
  Search,
  Trash2,
  LucideAngularModule,
} from 'lucide-angular';
import { WheelAction } from '../../core/models/hud.models';
import { RangeTargetCloseButtonComponent } from '../../shared/components/range-target-close-button.component';

interface RotarySlot {
  id: WheelAction | 'marker-menu';
  label: string;
  angleDeg: number;
  icon: typeof Search;
}

const ROTARY_SLOTS: readonly RotarySlot[] = [
  { id: 'map', label: 'Painel', angleDeg: 0, icon: Search },
  { id: 'filters', label: 'Filtros', angleDeg: 60, icon: Layers },
  { id: '3d', label: '2D / 3D', angleDeg: 120, icon: Box },
  { id: 'cinema', label: 'Cinema', angleDeg: 180, icon: EyeOff },
  { id: 'center', label: 'Centralizar', angleDeg: 240, icon: LocateFixed },
  { id: 'marker-menu', label: 'Marcador', angleDeg: 300, icon: MapPin },
];

const STEP_DEG = 60;

@Component({
  selector: 'app-map-rotary-dial',
  standalone: true,
  imports: [LucideAngularModule, RangeTargetCloseButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rotary-dial"
      role="menu"
      aria-label="Discador do Mapa"
      (pointerdown)="onPointerDown($event)"
      (click)="$event.stopPropagation(); closePinSubmenuIfOpen()"
    >
      <div class="rotary-notch" aria-hidden="true"></div>
      <div class="rotary-track" aria-hidden="true"></div>

      <div
        class="rotary-ring"
        [class.is-snapping]="!isDragging()"
        [style.transform]="'rotate(' + rotationDeg() + 'deg)'"
      >
        @for (slot of slots; track slot.id; let i = $index) {
          <div
            class="rotary-slot-anchor"
            [style.transform]="
              'translate(-50%, -50%) rotate(' +
              slot.angleDeg +
              'deg) translateY(calc(-1 * min(102px, 34dvw))) rotate(' +
              -slot.angleDeg +
              'deg)'
            "
          >
            <button
              type="button"
              class="rotary-slot"
              [class.is-snapping]="!isDragging()"
              [class.is-dialed]="i === activeSlotIndex()"
              [class.is-active]="
                (slot.id === '3d' && is3DMode()) ||
                (slot.id === 'marker-menu' && (isPinMode() || pinSubmenuOpen()))
              "
              [style.transform]="'rotate(' + -rotationDeg() + 'deg)'"
              role="menuitem"
              (click)="onSlotClick($event, slot)"
            >
              <lucide-icon [img]="slot.icon" [size]="16" [strokeWidth]="1.75" />
              <span>{{ slot.label }}</span>
              @if (slot.id === 'marker-menu' && customPinsCount() > 0) {
                <span class="rotary-badge">{{ customPinsCount() }}</span>
              }
            </button>
          </div>
        }
      </div>

      <button
        type="button"
        class="rotary-hub"
        aria-label="Voltar para a Mochila"
        (click)="$event.stopPropagation(); closeDial.emit()"
      >
        <span class="hub-title">{{ activeSlotLabel() }}</span>
        <span class="hub-hint">Gire ou toque</span>
        <span class="hub-back">Voltar</span>
      </button>

      @if (pinSubmenuOpen()) {
        <div
          class="rotary-pin-modal"
          role="menu"
          aria-label="Opções do Marcador"
          (pointerdown)="$event.stopPropagation()"
          (click)="$event.stopPropagation()"
        >
          <div class="pin-modal-header">
            <span>MARCADOR</span>
            <app-range-target-close
              ariaLabel="Fechar submenu do marcador"
              (close)="pinSubmenuOpen.set(false)"
            />
          </div>
          <button
            type="button"
            class="pin-sub-btn"
            [class.is-active]="isPinMode()"
            (click)="emitAction('pin')"
          >
            <lucide-icon [img]="icons.MapPin" [size]="14" [strokeWidth]="1.75" />
            <span>{{ isPinMode() ? 'Desativar' : 'Marcar' }}</span>
          </button>
          <div class="pin-sub-count">{{ customPinsCount() }} no mapa</div>
          <button
            type="button"
            class="pin-sub-btn is-danger"
            [disabled]="customPinsCount() === 0"
            (click)="emitAction('clear-pins')"
          >
            <lucide-icon [img]="icons.Trash2" [size]="14" [strokeWidth]="1.75" />
            <span>Remover todos</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .rotary-dial {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(296px, calc(100dvw - 24px));
        height: min(296px, calc(100dvw - 24px));
        border-radius: 50%;
        z-index: 55;
        touch-action: none;
        user-select: none;
        background: radial-gradient(circle, rgba(28, 18, 48, 0.96) 36%, rgba(18, 11, 30, 0.92) 100%);
        border: 2px solid #7B208F;
        box-shadow: 0 0 36px rgba(123, 32, 143, 0.45);
        animation:
          wheelPop 160ms cubic-bezier(0.22, 1, 0.36, 1) forwards,
          gtaWheelGlow 8s ease-in-out infinite;
      }

      @keyframes gtaWheelGlow {
        0%, 100% {
          border-color: #7B208F;
          box-shadow: 0 0 36px rgba(123, 32, 143, 0.45);
        }
        25% {
          border-color: #C9349B;
          box-shadow: 0 0 40px rgba(201, 52, 155, 0.48);
        }
        50% {
          border-color: #F36A78;
          box-shadow: 0 0 42px rgba(243, 106, 120, 0.48);
        }
        75% {
          border-color: #FF9B55;
          box-shadow: 0 0 40px rgba(255, 155, 85, 0.45);
        }
        90% {
          border-color: #FFB458;
          box-shadow: 0 0 38px rgba(255, 180, 88, 0.42);
        }
      }

      @keyframes wheelPop {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.84);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      .rotary-notch {
        position: absolute;
        top: -7px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 10px solid #ffb458;
        filter: drop-shadow(0 0 6px rgba(255, 180, 88, 0.75));
        z-index: 6;
        pointer-events: none;
      }

      .rotary-track {
        position: absolute;
        inset: 38px;
        border-radius: 50%;
        border: 1px dashed rgba(255, 180, 88, 0.35);
        pointer-events: none;
      }

      .rotary-ring {
        position: absolute;
        inset: 0;
        border-radius: 50%;
      }

      .rotary-ring.is-snapping,
      .rotary-slot.is-snapping {
        transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      .rotary-slot-anchor {
        position: absolute;
        top: 50%;
        left: 50%;
      }

      .rotary-slot {
        position: relative;
        width: 62px;
        height: 62px;
        border-radius: 50%;
        background: rgba(28, 18, 48, 0.95);
        border: 1px solid rgba(255, 180, 88, 0.35);
        color: var(--text-cream);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-family: var(--font-ui);
        font-size: 9px;
        font-weight: 600;
        cursor: grab;
        box-shadow: 0 6px 14px rgba(18, 11, 30, 0.7);
      }

      .rotary-slot.is-dialed {
        border-color: #ffb458;
        box-shadow: 0 0 14px rgba(255, 180, 88, 0.45);
      }

      .rotary-slot.is-active {
        border-color: #ff4fd8;
        color: #ff4fd8;
        background: rgba(255, 79, 216, 0.18);
      }

      .rotary-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: #ff4fd8;
        color: #120b1e;
        font-size: 9px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .rotary-hub {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 84px;
        height: 84px;
        border-radius: 50%;
        background: var(--bg-midnight);
        border: 1px solid var(--sunset-peach);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        cursor: pointer;
        z-index: 5;
        padding: 4px;
      }

      .hub-title {
        font-size: 11px;
        font-weight: 700;
        color: #ffb458;
        text-align: center;
        line-height: 1.1;
      }

      .hub-hint {
        font-size: 8px;
        color: var(--text-muted);
        letter-spacing: 0.03em;
      }

      .hub-back {
        font-size: 9px;
        font-weight: 600;
        color: #ff4fd8;
        margin-top: 2px;
      }

      .rotary-pin-modal {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 196px;
        z-index: 70;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        border-radius: 12px;
        background: rgba(18, 11, 30, 0.96);
        border: 1px solid rgba(255, 79, 216, 0.65);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.78);
      }

      .pin-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #ffb458;
      }

      .pin-sub-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 180, 88, 0.35);
        background: rgba(30, 16, 51, 0.92);
        color: #f8fafc;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .pin-sub-btn.is-active {
        border-color: #ff4fd8;
        background: rgba(255, 79, 216, 0.22);
      }

      .pin-sub-btn.is-danger {
        border-color: rgba(239, 68, 68, 0.55);
        color: #fca5a5;
      }

      .pin-sub-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .pin-sub-count {
        font-size: 11px;
        color: #ffb458;
        text-align: center;
        font-weight: 700;
      }
    `,
  ],
})
export class MapRotaryDialComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly is3DMode = input(false);
  readonly isPinMode = input(false);
  readonly customPinsCount = input(0);

  readonly selectAction = output<WheelAction>();
  readonly closeDial = output<void>();

  readonly slots = ROTARY_SLOTS;
  readonly icons = { MapPin, Trash2 };

  readonly rotationDeg = signal(0);
  readonly isDragging = signal(false);
  readonly pinSubmenuOpen = signal(false);

  readonly activeSlotIndex = computed(
    () => ((Math.round(-this.rotationDeg() / STEP_DEG) % ROTARY_SLOTS.length) + ROTARY_SLOTS.length) % ROTARY_SLOTS.length,
  );
  readonly activeSlotLabel = computed(() => ROTARY_SLOTS[this.activeSlotIndex()].label);

  private didDrag = false;
  private cleanupListeners: (() => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanupListeners?.());
  }

  onPointerDown(event: PointerEvent): void {
    if (this.pinSubmenuOpen()) {
      return;
    }

    const dialEl = event.currentTarget as HTMLElement;
    const rect = dialEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let lastAngle = Math.atan2(event.clientY - cy, event.clientX - cx) * (180 / Math.PI);
    let totalMovedDeg = 0;
    this.didDrag = false;
    this.isDragging.set(true);

    const onMove = (moveEvent: PointerEvent): void => {
      const currentAngle = Math.atan2(moveEvent.clientY - cy, moveEvent.clientX - cx) * (180 / Math.PI);
      let delta = currentAngle - lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastAngle = currentAngle;

      totalMovedDeg += Math.abs(delta);
      if (totalMovedDeg > 6) {
        this.didDrag = true;
      }
      this.rotationDeg.update((r) => r + delta);
    };

    const onUp = (): void => {
      this.cleanupListeners?.();
      this.cleanupListeners = null;
      this.isDragging.set(false);
      this.rotationDeg.update((r) => Math.round(r / STEP_DEG) * STEP_DEG);
      if (this.didDrag) {
        setTimeout(() => {
          this.didDrag = false;
        }, 50);
      }
    };

    this.cleanupListeners?.();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    this.cleanupListeners = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }

  onSlotClick(event: MouseEvent, slot: RotarySlot): void {
    event.stopPropagation();
    if (this.didDrag) {
      this.didDrag = false;
      return;
    }
    if (slot.id === 'marker-menu') {
      this.pinSubmenuOpen.set(true);
      return;
    }
    this.selectAction.emit(slot.id);
  }

  emitAction(action: WheelAction): void {
    this.pinSubmenuOpen.set(false);
    this.selectAction.emit(action);
  }

  closePinSubmenuIfOpen(): boolean {
    if (!this.pinSubmenuOpen()) {
      return false;
    }
    this.pinSubmenuOpen.set(false);
    return true;
  }
}
