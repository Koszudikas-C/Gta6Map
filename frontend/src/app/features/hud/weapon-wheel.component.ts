import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Box, Crown, EyeOff, Layers, Map, Search, User, LucideAngularModule } from 'lucide-angular';

export type WheelAction = 'map' | 'filters' | '3d' | 'cinema';

@Component({
  selector: 'app-weapon-wheel',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="wheel-backdrop" (click)="closeAll()" aria-hidden="true"></div>
      <div
        class="weapon-wheel"
        role="menu"
        aria-label="Roleta da Mochila"
        (click)="$event.stopPropagation()"
        (mouseleave)="mapFanOpen.set(false)"
      >
        <div class="wheel-watermark" aria-hidden="true">VI</div>
        <div class="wheel-center font-display">MOCHILA</div>

        <!-- Módulo Principal: Mapa (abre leque por cima) -->
        <div
          class="map-anchor"
          (mouseenter)="openFan()"
          (mouseleave)="scheduleCloseFan()"
        >
          <button
            type="button"
            class="wheel-slot slot-top"
            [class.is-active]="mapFanOpen()"
            role="menuitem"
            aria-haspopup="true"
            [attr.aria-expanded]="mapFanOpen()"
            (click)="toggleFanLock()"
          >
            <lucide-icon [img]="icons.Map" [size]="18" [strokeWidth]="1.75" />
            <span>Mapa</span>
          </button>

          @if (mapFanOpen()) {
            <div
              class="map-fan"
              role="menu"
              aria-label="Opções do Mapa"
              (mouseenter)="openFan()"
              (mouseleave)="scheduleCloseFan()"
            >
              <div class="fan-bridge" aria-hidden="true"></div>
              <button
                type="button"
                class="fan-item fan-1"
                role="menuitem"
                (click)="onSelect('map')"
              >
                <lucide-icon [img]="icons.Search" [size]="15" [strokeWidth]="1.75" />
                <span>Painel</span>
              </button>
              <button
                type="button"
                class="fan-item fan-2"
                role="menuitem"
                (click)="onSelect('filters')"
              >
                <lucide-icon [img]="icons.Layers" [size]="15" [strokeWidth]="1.75" />
                <span>Filtros</span>
              </button>
              <button
                type="button"
                class="fan-item fan-3"
                [class.is-active]="is3DMode()"
                role="menuitem"
                (click)="onSelect('3d')"
              >
                <lucide-icon [img]="icons.Box" [size]="15" [strokeWidth]="1.75" />
                <span>2D / 3D</span>
              </button>
              <button
                type="button"
                class="fan-item fan-4"
                role="menuitem"
                (click)="onSelect('cinema')"
              >
                <lucide-icon [img]="icons.EyeOff" [size]="15" [strokeWidth]="1.75" />
                <span>Cinema</span>
              </button>
            </div>
          }
        </div>

        <!-- Módulos Reservados -->
        <button
          type="button"
          class="wheel-slot slot-right is-reserved"
          role="menuitem"
          disabled
          title="Em breve"
        >
          <lucide-icon [img]="icons.Crown" [size]="16" [strokeWidth]="1.75" />
          <span>VIP / Cotas</span>
          <small>Em breve</small>
        </button>

        <button
          type="button"
          class="wheel-slot slot-left is-reserved"
          role="menuitem"
          disabled
          title="Em breve"
        >
          <lucide-icon [img]="icons.User" [size]="16" [strokeWidth]="1.75" />
          <span>Perfil</span>
          <small>Em breve</small>
        </button>
      </div>
    }
  `,
  styles: [
    `
      .wheel-backdrop {
        position: fixed;
        inset: 0;
        z-index: 35;
        background: rgba(18, 11, 30, 0.45);
        backdrop-filter: blur(4px);
      }

      .weapon-wheel {
        position: fixed;
        top: 50%;
        left: 50%;
        width: 268px;
        height: 268px;
        transform: translate(-50%, -50%);
        z-index: 45;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(28, 18, 48, 0.94) 36%, rgba(18, 11, 30, 0.88) 100%);
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

      @keyframes slotIn {
        from {
          opacity: 0;
          scale: 0.8;
        }
        to {
          opacity: 1;
          scale: 1;
        }
      }

      .wheel-watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -55%);
        font-family: 'GtaDisplay', var(--font-display);
        font-size: 250px;
        line-height: 0.85;
        background: var(--gradient-signature);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        opacity: 0.24;
        filter: drop-shadow(0 0 18px rgba(243, 106, 120, 0.22));
        pointer-events: none;
        user-select: none;
      }

      .wheel-center {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 82px;
        height: 82px;
        border-radius: 50%;
        background: var(--bg-midnight);
        border: 1px solid var(--sunset-peach);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        color: var(--sunset-peach);
        letter-spacing: 0.08em;
        pointer-events: none;
      }

      .wheel-slot {
        position: absolute;
        width: 74px;
        height: 74px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: rgba(28, 18, 48, 0.92);
        border: 1px solid var(--border-hairline);
        color: var(--text-cream);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-family: var(--font-ui);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        animation: slotIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
        transition: border-color 140ms ease, background-color 140ms ease, scale 140ms ease;
      }

      .wheel-slot:not(:disabled):hover,
      .wheel-slot:not(:disabled):focus-visible,
      .wheel-slot.is-active {
        border-color: var(--vice-magenta);
        background: rgba(244, 78, 143, 0.22);
        scale: 1.08;
      }

      .wheel-slot.is-reserved {
        opacity: 0.42;
        cursor: not-allowed;
        border-style: dashed;
      }

      .wheel-slot.is-reserved small {
        font-size: 9px;
        color: var(--text-muted);
      }

      .slot-top {
        top: calc(50% - 86px);
        left: 50%;
        animation-delay: 60ms;
      }
      .slot-right {
        top: calc(50% + 43px);
        left: calc(50% + 74px);
        animation-delay: 130ms;
      }
      .slot-left {
        top: calc(50% + 43px);
        left: calc(50% - 74px);
        animation-delay: 200ms;
      }

      /* Fan Submenu above Mapa */
      .map-fan {
        position: absolute;
        top: 50%;
        left: 50%;
        pointer-events: none;
        z-index: 50;
      }

      .fan-bridge {
        pointer-events: auto;
        position: absolute;
        top: -185px;
        left: -135px;
        width: 270px;
        height: 110px;
      }

      .fan-item {
        pointer-events: auto;
        position: absolute;
        width: 66px;
        height: 44px;
        margin: -22px 0 0 -33px;
        border-radius: var(--radius-sm);
        background: rgba(28, 18, 48, 0.96);
        border: 1px solid var(--twilight-purple);
        color: var(--text-cream);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-family: var(--font-ui);
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        opacity: 0;
        box-shadow: 0 6px 18px rgba(18, 11, 30, 0.65);
        animation: slotIn 160ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        transition: border-color 140ms ease, background-color 140ms ease, scale 140ms ease;
      }

      .fan-item:hover,
      .fan-item:focus-visible {
        border-color: var(--vice-magenta);
        background: rgba(244, 78, 143, 0.24);
        scale: 1.06;
      }

      .fan-item.is-active {
        border-color: var(--palm-teal);
        color: var(--palm-teal);
      }

      .fan-1 { transform: translate(-108px, -138px); animation-delay: 20ms; }
      .fan-2 { transform: translate(-38px, -162px); animation-delay: 50ms; }
      .fan-3 { transform: translate(38px, -162px); animation-delay: 80ms; }
      .fan-4 { transform: translate(108px, -138px); animation-delay: 110ms; }
    `,
  ],
})
export class WeaponWheelComponent {
  readonly isOpen = input(false);
  readonly is3DMode = input(false);

  readonly selectItem = output<WheelAction>();
  readonly closeWheel = output<void>();

  readonly mapFanOpen = signal(false);
  readonly mapFanLocked = signal(false);
  private closeFanTimer: ReturnType<typeof setTimeout> | null = null;

  readonly icons = { Map, Search, Layers, Box, EyeOff, Crown, User };

  openFan(): void {
    if (this.closeFanTimer !== null) {
      clearTimeout(this.closeFanTimer);
      this.closeFanTimer = null;
    }
    this.mapFanOpen.set(true);
  }

  scheduleCloseFan(): void {
    if (this.mapFanLocked()) {
      return;
    }
    if (this.closeFanTimer !== null) {
      clearTimeout(this.closeFanTimer);
    }
    this.closeFanTimer = setTimeout(() => {
      this.closeFanTimer = null;
      this.mapFanOpen.set(false);
    }, 200);
  }

  toggleFanLock(): void {
    const nextLocked = !this.mapFanLocked();
    this.mapFanLocked.set(nextLocked);
    if (nextLocked) {
      this.openFan();
    } else {
      this.mapFanOpen.set(false);
    }
  }

  onSelect(action: WheelAction): void {
    this.mapFanLocked.set(false);
    this.mapFanOpen.set(false);
    this.selectItem.emit(action);
  }

  closeAll(): void {
    this.mapFanLocked.set(false);
    this.mapFanOpen.set(false);
    this.closeWheel.emit();
  }
}
