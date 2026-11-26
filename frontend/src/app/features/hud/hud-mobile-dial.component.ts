import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Backpack, Box, EyeOff, Maximize2, Search, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-hud-mobile-dial',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mobile-dial hud-panel" aria-label="Controles táteis">
      <button type="button" class="dial-item" (click)="toggleSidebar.emit()">
        <lucide-icon [img]="icons.Backpack" [size]="15" [strokeWidth]="1.75" />
        <span>Mochila</span>
      </button>
      <button type="button" class="dial-item" (click)="focusSearch.emit()">
        <lucide-icon [img]="icons.Search" [size]="15" [strokeWidth]="1.75" />
        <span>Buscar</span>
      </button>
      <button
        type="button"
        class="dial-item"
        [class.is-active]="is3DMode()"
        (click)="toggle3D.emit()"
      >
        <lucide-icon [img]="icons.Box" [size]="15" [strokeWidth]="1.75" />
        <span>2D/3D</span>
      </button>
      <button type="button" class="dial-item" (click)="toggleFullscreen.emit()">
        <lucide-icon [img]="icons.Maximize2" [size]="15" [strokeWidth]="1.75" />
        <span>Tela Cheia</span>
      </button>
      <button type="button" class="dial-item" (click)="toggleCinema.emit()">
        <lucide-icon [img]="icons.EyeOff" [size]="15" [strokeWidth]="1.75" />
        <span>Cinema</span>
      </button>
    </nav>
  `,
  styles: [
    `
      .mobile-dial {
        position: absolute;
        bottom: 12px;
        left: 12px;
        right: 12px;
        z-index: 25;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        max-width: calc(100dvw - 24px);
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
        -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
      }

      .mobile-dial::-webkit-scrollbar {
        display: none;
      }

      .dial-item {
        flex: 0 0 auto;
        scroll-snap-align: center;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 4px 10px;
        background-color: rgba(18, 11, 30, 0.75);
        border: 1px solid var(--border-hairline);
        border-radius: var(--radius-xs);
        color: var(--text-cream);
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      }

      .dial-item.is-active {
        border-color: var(--vice-magenta);
        color: var(--vice-magenta);
      }
    `,
  ],
})
export class HudMobileDialComponent {
  readonly is3DMode = input(false);

  readonly toggleSidebar = output<void>();
  readonly focusSearch = output<void>();
  readonly toggle3D = output<void>();
  readonly toggleFullscreen = output<void>();
  readonly toggleCinema = output<void>();

  readonly icons = { Backpack, Box, EyeOff, Maximize2, Search };
}
