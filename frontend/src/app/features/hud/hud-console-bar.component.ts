import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Gamepad2, LucideAngularModule } from 'lucide-angular';
import { GamepadService } from '../../core/services/gamepad.service';

@Component({
  selector: 'app-hud-console-bar',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gamepad-hud hud-panel" role="status" aria-live="polite">
      <lucide-icon [img]="gamepadIcon" [size]="16" [strokeWidth]="1.75" class="gamepad-icon" />
      @for (item of gamepadService.legends(); track item.button) {
        <div class="legend-item">
          <kbd class="legend-key font-mono-tactical">{{ item.button }}</kbd>
          <span class="legend-label">{{ item.label }}</span>
        </div>
      }
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

      .gamepad-icon {
        color: var(--palm-teal);
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
export class HudConsoleBarComponent {
  readonly gamepadService = inject(GamepadService);
  readonly gamepadIcon = Gamepad2;
}
