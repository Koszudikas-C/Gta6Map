import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-hud-desktop-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gamepad-hud desktop-hints hud-panel" aria-label="Atalhos de teclado">
      <div class="legend-item">
        <kbd class="legend-key font-mono-tactical">M</kbd>
        <span class="legend-label">Mochila</span>
      </div>
      <div class="legend-item">
        <kbd class="legend-key font-mono-tactical">/</kbd>
        <span class="legend-label">Buscar</span>
      </div>
      <div class="legend-item">
        <kbd class="legend-key font-mono-tactical">+/-</kbd>
        <span class="legend-label">Zoom</span>
      </div>
      <div class="legend-item">
        <kbd class="legend-key font-mono-tactical">3</kbd>
        <span class="legend-label">2D/3D</span>
      </div>
      <div class="legend-item">
        <kbd class="legend-key font-mono-tactical">F</kbd>
        <span class="legend-label">Tela Cheia</span>
      </div>
      <div class="legend-item">
        <kbd class="legend-key font-mono-tactical">H</kbd>
        <span class="legend-label">Cinema</span>
      </div>
    </div>
  `,
  styles: [
    `
      .gamepad-hud {
        position: absolute;
        bottom: var(--hud-edge, 16px);
        left: 50%;
        transform: translateX(-50%);
        z-index: 25;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }

      .legend-key {
        padding: 2px 6px;
        background-color: rgba(76, 224, 210, 0.14);
        border: 1px solid var(--palm-teal);
        border-radius: var(--radius-xs);
        color: var(--palm-teal);
        font-size: 11px;
        font-weight: 700;
      }
    `,
  ],
})
export class HudDesktopBarComponent {}
