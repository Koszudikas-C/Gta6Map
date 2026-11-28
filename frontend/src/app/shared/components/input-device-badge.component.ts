import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type InputDeviceKind = 'playstation' | 'xbox' | 'generic' | 'desktop' | 'mobile';

@Component({
  selector: 'app-input-device-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="device-badge" [title]="label()" [attr.aria-label]="label()">
      @switch (device()) {
        @case ('playstation') {
          <svg width="34" height="24" viewBox="0 0 36 26" fill="none" aria-hidden="true">
            <path
              d="M9.5 5.5h17c2.1 0 3.7 1.3 4.3 3.3l2.1 8.5c.6 2.4-1.2 4.7-3.6 4.7-1.4 0-2.6-.7-3.3-1.9l-1.9-3.1H11.9L10 20.1c-.7 1.2-1.9 1.9-3.3 1.9-2.4 0-4.2-2.3-3.6-4.7l2.1-8.5c.6-2 2.2-3.3 4.3-3.3z"
              fill="#180F29"
              stroke="#F44E8F"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <rect x="13.5" y="7" width="9" height="4.2" rx="1" fill="#2A1B47" stroke="#FFB458" stroke-width="1.1" />
            <path d="M8.5 9.5v3.6M6.7 11.3h3.6" stroke="#FFF6F8" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="13.8" cy="14.5" r="2" fill="#2A1B47" stroke="#FFB458" stroke-width="1.2" />
            <circle cx="22.2" cy="14.5" r="2" fill="#2A1B47" stroke="#FFB458" stroke-width="1.2" />
            <circle cx="27.5" cy="9.6" r="0.85" fill="#4ADE80" />
            <circle cx="29.3" cy="11.3" r="0.85" fill="#F44E8F" />
            <circle cx="27.5" cy="13" r="0.85" fill="#60A5FA" />
            <circle cx="25.7" cy="11.3" r="0.85" fill="#FB7185" />
          </svg>
          <span class="device-tag">PS</span>
        }
        @case ('xbox') {
          <svg width="34" height="24" viewBox="0 0 36 26" fill="none" aria-hidden="true">
            <path
              d="M10 5h16c2.4 0 4.2 1.5 4.8 3.8l2 8c.6 2.5-1.3 4.9-3.8 4.9-1.5 0-2.8-.8-3.6-2l-1.6-2.7H12.2l-1.6 2.7c-.8 1.2-2.1 2-3.6 2-2.5 0-4.4-2.4-3.8-4.9l2-8C5.8 6.5 7.6 5 10 5z"
              fill="#180F29"
              stroke="#22C55E"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <circle cx="18" cy="8.8" r="1.7" fill="#22C55E" fill-opacity="0.25" stroke="#FFB458" stroke-width="1.2" />
            <circle cx="9.6" cy="10.2" r="2.1" fill="#2A1B47" stroke="#FFB458" stroke-width="1.2" />
            <path d="M13.5 13.2v3M12 14.7h3" stroke="#FFF6F8" stroke-width="1.4" stroke-linecap="round" />
            <circle cx="22.3" cy="14.7" r="2.1" fill="#2A1B47" stroke="#FFB458" stroke-width="1.2" />
            <circle cx="26.8" cy="8.5" r="0.85" fill="#FACC15" />
            <circle cx="28.6" cy="10.2" r="0.85" fill="#EF4444" />
            <circle cx="26.8" cy="11.9" r="0.85" fill="#22C55E" />
            <circle cx="25" cy="10.2" r="0.85" fill="#60A5FA" />
          </svg>
          <span class="device-tag is-xbox">XBOX</span>
        }
        @case ('generic') {
          <svg width="34" height="24" viewBox="0 0 36 26" fill="none" aria-hidden="true">
            <path
              d="M9.5 6h17c2.1 0 3.7 1.3 4.3 3.3l1.9 7.8c.6 2.4-1.2 4.6-3.5 4.6-1.4 0-2.6-.7-3.3-1.8l-1.7-2.9H11.8l-1.7 2.9c-.7 1.1-1.9 1.8-3.3 1.8-2.3 0-4.1-2.2-3.5-4.6l1.9-7.8C5.8 7.3 7.4 6 9.5 6z"
              fill="#180F29"
              stroke="#F44E8F"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <path d="M9.5 9.8v3.4M7.8 11.5h3.4" stroke="#FFB458" stroke-width="1.6" stroke-linecap="round" />
            <circle cx="14.2" cy="14.3" r="1.8" fill="#2A1B47" stroke="#FFB458" stroke-width="1.2" />
            <circle cx="21.8" cy="14.3" r="1.8" fill="#2A1B47" stroke="#FFB458" stroke-width="1.2" />
            <circle cx="26.8" cy="9.8" r="0.9" fill="#FFB458" />
            <circle cx="28.6" cy="11.5" r="0.9" fill="#F44E8F" />
            <circle cx="26.8" cy="13.2" r="0.9" fill="#F44E8F" />
            <circle cx="25" cy="11.5" r="0.9" fill="#FFB458" />
          </svg>
          <span class="device-tag">PAD</span>
        }
        @case ('desktop') {
          <svg width="34" height="24" viewBox="0 0 36 24" fill="none" aria-hidden="true">
            <rect x="1.5" y="4.5" width="21" height="15" rx="2.5" fill="#180F29" stroke="#F44E8F" stroke-width="1.5" />
            <path d="M4.5 8h2M8.5 8h2M12.5 8h2M16.5 8h2M4.5 11.5h2M8.5 11.5h2M12.5 11.5h2M16.5 11.5h2M6.5 15h10" stroke="#FFB458" stroke-width="1.5" stroke-linecap="round" />
            <rect x="25.5" y="5" width="8.5" height="14" rx="4.25" fill="#180F29" stroke="#FFB458" stroke-width="1.5" />
            <path d="M29.75 7.8v2.6" stroke="#F44E8F" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        }
        @case ('mobile') {
          <svg width="22" height="24" viewBox="0 0 24 26" fill="none" aria-hidden="true">
            <rect x="5.5" y="2" width="13" height="22" rx="3" fill="#180F29" stroke="#F44E8F" stroke-width="1.6" />
            <rect x="9.5" y="4.2" width="5" height="1.2" rx="0.6" fill="#FFB458" />
            <rect x="7.5" y="7" width="9" height="12.5" rx="1" fill="#2A1B47" />
            <path d="M9.5 21.2h5" stroke="#FFB458" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        }
      }
    </span>
  `,
  styles: [
    `
      .device-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(244, 78, 143, 0.16) 0%, rgba(255, 180, 88, 0.12) 100%);
        border: 1px solid rgba(244, 78, 143, 0.45);
        flex-shrink: 0;
      }

      .device-tag {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.06em;
        color: #ffb458;
      }

      .device-tag.is-xbox {
        color: #4ade80;
      }
    `,
  ],
})
export class InputDeviceBadgeComponent {
  readonly device = input.required<InputDeviceKind>();

  readonly label = computed(() => {
    switch (this.device()) {
      case 'playstation':
        return 'Controle PlayStation';
      case 'xbox':
        return 'Controle Xbox';
      case 'generic':
        return 'Controle Gamepad';
      case 'desktop':
        return 'Teclado e Mouse';
      case 'mobile':
        return 'Celular / Toque';
    }
  });
}
