import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { GamepadService } from '../../core/services/gamepad.service';
import { InputDeviceBadgeComponent } from '../../shared/components/input-device-badge.component';
import { ShortcutKeyBadgeComponent } from '../../shared/components/shortcut-key-badge.component';

@Component({
  selector: 'app-hud-console-bar',
  standalone: true,
  imports: [InputDeviceBadgeComponent, ShortcutKeyBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gamepad-hud hud-panel" role="status" aria-live="polite">
      <app-input-device-badge [device]="gamepadService.controllerType()" />
      @if (!compact()) {
        @for (item of gamepadService.legends(); track item.button) {
          <div class="legend-item">
            <app-shortcut-key-badge [key]="item.button" />
            <span class="legend-label">{{ item.label }}</span>
          </div>
        }
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
        flex-wrap: wrap;
        justify-content: center;
        max-width: calc(100vw - 32px);
        align-items: center;
        gap: 10px 14px;
        padding: 8px 14px;
      }

      app-input-device-badge {
        align-self: center;
        display: inline-flex;
        align-items: center;
      }

      .gamepad-icon {
        color: var(--vice-magenta);
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }

      .legend-key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 20px;
        line-height: 1;
        padding: 2px 6px;
        background-color: rgba(255, 166, 107, 0.14);
        border: 1px solid var(--sunset-peach);
        border-radius: var(--radius-xs);
        color: var(--sunset-peach);
        font-size: 11px;
        font-weight: 700;
      }
    `,
  ],
})
export class HudConsoleBarComponent {
  readonly gamepadService = inject(GamepadService);
  readonly compact = input(false);
}
