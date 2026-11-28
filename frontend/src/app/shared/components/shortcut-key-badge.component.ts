import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-shortcut-key-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (key(); as k) {
      <kbd class="skb-pill font-mono-tactical" [attr.data-key]="k">
        @switch (k) {
          @case ('✕') {
            <svg class="skb-svg ps-cross" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true">
              <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" />
            </svg>
            <span class="skb-sr">{{ k }}</span>
          }
          @case ('○') {
            <svg class="skb-svg ps-circle" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="8" cy="8" r="4.6" />
            </svg>
            <span class="skb-sr">{{ k }}</span>
          }
          @case ('□') {
            <svg class="skb-svg ps-square" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true">
              <rect x="3.8" y="3.8" width="8.4" height="8.4" rx="1.2" />
            </svg>
            <span class="skb-sr">{{ k }}</span>
          }
          @case ('△') {
            <svg class="skb-svg ps-triangle" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true">
              <polygon points="8,3 13,12.2 3,12.2" />
            </svg>
            <span class="skb-sr">{{ k }}</span>
          }
          @case ('D-Pad') {
            <svg class="skb-svg skb-dpad" viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="M6.3 2h3.4v4.3H14v3.4H9.7V14H6.3V9.7H2V6.3h4.3V2Z" />
            </svg>
            <span class="skb-sr">{{ k }}</span>
          }
          @case ('L1') { <span class="skb-bumper">L1</span> }
          @case ('R1') { <span class="skb-bumper">R1</span> }
          @case ('LB') { <span class="skb-bumper">LB</span> }
          @case ('RB') { <span class="skb-bumper">RB</span> }
          @case ('L2') { <span class="skb-trigger">L2</span> }
          @case ('R2') { <span class="skb-trigger">R2</span> }
          @case ('LT') { <span class="skb-trigger">LT</span> }
          @case ('RT') { <span class="skb-trigger">RT</span> }
          @case ('L3') {
            <svg class="skb-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <circle cx="8" cy="8" r="3" />
            </svg>
            <span>L3</span>
          }
          @case ('R3') {
            <svg class="skb-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <circle cx="8" cy="8" r="3" />
            </svg>
            <span>R3</span>
          }
          @case ('LS') {
            <svg class="skb-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <circle cx="8" cy="8" r="3" />
            </svg>
            <span>LS</span>
          }
          @case ('RS') {
            <svg class="skb-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <circle cx="8" cy="8" r="3" />
            </svg>
            <span>RS</span>
          }
          @case ('Options') {
            <svg class="skb-svg" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M3 4.5h10M3 8h10M3 11.5h10" />
            </svg>
            <span>Options</span>
          }
          @default {
            <span>{{ k }}</span>
          }
        }
      </kbd>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
      }

      .skb-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 5px;
        background: rgba(255, 166, 107, 0.12);
        border: 1px solid rgba(255, 166, 107, 0.45);
        color: #fff6f8;
        font-size: 10.5px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.02em;
      }

      .skb-bumper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 2px;
        border-radius: 6px 6px 2px 2px;
      }

      .skb-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 2px;
        border-radius: 3px 3px 8px 8px;
      }

      .skb-pill[data-key='L1'],
      .skb-pill[data-key='R1'],
      .skb-pill[data-key='L2'],
      .skb-pill[data-key='R2'],
      .skb-pill[data-key='L2/R2'],
      .skb-pill[data-key='L3'],
      .skb-pill[data-key='R3'],
      .skb-pill[data-key='Options'],
      .skb-pill[data-key='D-Pad'] {
        background: rgba(15, 23, 42, 0.9);
        border-color: rgba(148, 163, 184, 0.65);
        color: #e2e8f0;
      }

      .skb-pill[data-key='L1'],
      .skb-pill[data-key='R1'] {
        border-radius: 8px 8px 3px 3px;
        border-top-width: 2px;
      }

      .skb-pill[data-key='L2'],
      .skb-pill[data-key='R2'],
      .skb-pill[data-key='L2/R2'] {
        border-radius: 4px 4px 10px 10px;
        border-bottom-width: 2px;
      }

      .skb-pill[data-key='L3'],
      .skb-pill[data-key='R3'] {
        border-radius: 999px;
        border-color: rgba(148, 163, 184, 0.7);
      }

      .skb-pill[data-key='LB'],
      .skb-pill[data-key='RB'],
      .skb-pill[data-key='LT'],
      .skb-pill[data-key='RT'],
      .skb-pill[data-key='LT/RT'],
      .skb-pill[data-key='LS'],
      .skb-pill[data-key='RS'],
      .skb-pill[data-key='Menu'] {
        background: rgba(18, 28, 22, 0.9);
        border-color: rgba(74, 222, 128, 0.65);
        color: #86efac;
      }

      .skb-pill[data-key='LB'],
      .skb-pill[data-key='RB'] {
        border-radius: 8px 8px 3px 3px;
        border-top-width: 2px;
      }

      .skb-pill[data-key='LT'],
      .skb-pill[data-key='RT'],
      .skb-pill[data-key='LT/RT'] {
        border-radius: 4px 4px 10px 10px;
        border-bottom-width: 2px;
      }

      .skb-pill[data-key='LS'],
      .skb-pill[data-key='RS'] {
        border-radius: 999px;
      }

      .skb-pill[data-key='A'] {
        width: 20px;
        padding: 0;
        border-radius: 999px;
        border-color: rgba(34, 197, 94, 0.75);
        color: #4ade80;
        background: rgba(18, 11, 30, 0.85);
      }
      .skb-pill[data-key='B'] {
        width: 20px;
        padding: 0;
        border-radius: 999px;
        border-color: rgba(239, 68, 68, 0.75);
        color: #f87171;
        background: rgba(18, 11, 30, 0.85);
      }
      .skb-pill[data-key='X'] {
        width: 20px;
        padding: 0;
        border-radius: 999px;
        border-color: rgba(59, 130, 246, 0.75);
        color: #60a5fa;
        background: rgba(18, 11, 30, 0.85);
      }
      .skb-pill[data-key='Y'] {
        width: 20px;
        padding: 0;
        border-radius: 999px;
        border-color: rgba(245, 158, 11, 0.75);
        color: #fbbf24;
        background: rgba(18, 11, 30, 0.85);
      }

      .skb-pill[data-key='✕'],
      .skb-pill[data-key='○'],
      .skb-pill[data-key='□'],
      .skb-pill[data-key='△'] {
        width: 20px;
        padding: 0;
        border-radius: 999px;
        background: rgba(18, 11, 30, 0.85);
      }

      .skb-pill[data-key='✕'] {
        border-color: rgba(96, 165, 250, 0.65);
        color: #60a5fa;
      }

      .skb-pill[data-key='○'] {
        border-color: rgba(251, 113, 133, 0.65);
        color: #fb7185;
      }

      .skb-pill[data-key='□'] {
        border-color: rgba(244, 114, 182, 0.65);
        color: #f472b6;
      }

      .skb-pill[data-key='△'] {
        border-color: rgba(52, 211, 153, 0.65);
        color: #34d399;
      }

      .skb-pill[data-key='D-Pad'] {
        padding: 0 5px;
        color: #ffb458;
        border-color: rgba(255, 180, 88, 0.45);
      }

      .skb-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
      }
    `,
  ],
})
export class ShortcutKeyBadgeComponent {
  readonly key = input<string | null>(null);
}
