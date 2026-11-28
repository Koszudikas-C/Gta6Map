import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getPoiCategoryMeta, getPoiItemMeta } from '../../core/data/poi-category-icons';

@Component({
  selector: 'app-poi-blip-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = meta();
    @if (variant() === 'badge') {
      <span
        class="blip-badge"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.borderColor]="m.color"
        [style.boxShadow]="'0 0 10px ' + m.color + '40'"
        aria-hidden="true"
      >
        <svg
          [attr.width]="size() * 0.56"
          [attr.height]="size() * 0.56"
          viewBox="0 0 24 24"
          fill="none"
        >
          @for (shape of m.shapes; track $index) {
            <path [attr.d]="shape.d" fill="#FFF6F8" [attr.fill-opacity]="shape.opacity ?? 1" />
          }
        </svg>
      </span>
    } @else {
      <svg
        class="blip-glyph"
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 24 24"
        fill="none"
        [style.filter]="'drop-shadow(0 0 4px ' + m.color + '66)'"
        aria-hidden="true"
      >
        @for (shape of m.shapes; track $index) {
          <path [attr.d]="shape.d" [attr.fill]="m.color" [attr.fill-opacity]="shape.opacity ?? 1" />
        }
      </svg>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .blip-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #24153d 0%, #120b1e 100%);
        border: 1.5px solid;
        flex-shrink: 0;
      }

      .blip-glyph {
        display: block;
        flex-shrink: 0;
      }
    `,
  ],
})
export class PoiBlipIconComponent {
  readonly category = input.required<string>();
  readonly itemName = input<string>('');
  readonly size = input<number>(28);
  readonly variant = input<'badge' | 'glyph'>('badge');

  readonly meta = computed(() => {
    const name = this.itemName();
    return name ? getPoiItemMeta(this.category(), name) : getPoiCategoryMeta(this.category());
  });
}
