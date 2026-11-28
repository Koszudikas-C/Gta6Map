import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

interface BulletHole {
  x: number;
  y: number;
}

const globalBulletHoles = signal<BulletHole[]>([]);

@Component({
  selector: 'app-range-target-close',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="range-target-btn"
      [class.is-hit]="isHit()"
      [attr.aria-label]="ariaLabel"
      [title]="ariaLabel"
      (click)="onShoot($event)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M6 21v-4a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4" stroke="#FFB458" />
        <circle cx="12" cy="8" r="5" stroke="#EF4444" />
        <circle cx="12" cy="8" r="2.6" stroke="#FFB458" />
        <circle cx="12" cy="8" r="1" fill="#EF4444" />
      </svg>
      @for (hole of holes(); track $index) {
        <span class="bullet-hole" [style.left.px]="hole.x - 2.5" [style.top.px]="hole.y - 2.5"></span>
      }
    </button>
  `,
  styles: [
    `
      .range-target-btn {
        position: relative;
        overflow: hidden;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid rgba(239, 68, 68, 0.72);
        color: #ef4444;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: crosshair;
        padding: 0;
        outline: none;
        transition: background 110ms ease, box-shadow 110ms ease;
      }

      .range-target-btn:hover {
        background: rgba(239, 68, 68, 0.38);
        box-shadow: 0 0 12px rgba(239, 68, 68, 0.65);
      }

      .range-target-btn.is-hit {
        background: rgba(255, 180, 88, 0.28);
      }

      .bullet-hole {
        position: absolute;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #09050f;
        box-shadow: 0 0 0 1px #ffb458;
        pointer-events: none;
      }
    `,
  ],
})
export class RangeTargetCloseButtonComponent {
  @Input() ariaLabel = 'Atirar no alvo para fechar';
  @Output() close = new EventEmitter<void>();

  readonly holes = globalBulletHoles;
  readonly isHit = signal(false);

  onShoot(event: MouseEvent): void {
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = Math.max(3, Math.min(rect.width - 3, event.clientX - rect.left));
    const y = Math.max(3, Math.min(rect.height - 3, event.clientY - rect.top));

    const current = this.holes();
    this.holes.set(current.length >= 3 ? [{ x, y }] : [...current, { x, y }]);

    this.isHit.set(true);
    setTimeout(() => {
      this.isHit.set(false);
      this.close.emit();
    }, 220);
  }
}
