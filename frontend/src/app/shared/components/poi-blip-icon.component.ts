import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { getPoiCategoryMeta, getPoiIconUrl, getPoiItemMeta } from '../../core/data/poi-category-icons';

@Component({
  selector: 'app-poi-blip-icon',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = meta();
    @let pngUrl = resolvedIconUrl();
    @if (variant() === 'badge') {
      <span
        class="blip-badge"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.borderColor]="m.color"
        [style.boxShadow]="'inset 0 1px 0 rgba(255, 246, 248, 0.22), 0 0 10px ' + m.color + '44'"
        aria-hidden="true"
      >
        @if (pngUrl) {
          <img [src]="pngUrl" alt="" class="blip-png" decoding="async" loading="lazy" />
        } @else {
          <lucide-icon
            [img]="m.icon"
            [size]="size() * 0.56"
            [strokeWidth]="2.1"
            color="#FFF6F8"
            class="blip-lucide"
          />
        }
      </span>
    } @else {
      <lucide-icon
        [img]="m.icon"
        [size]="size()"
        [strokeWidth]="2.1"
        [color]="m.color"
        class="blip-glyph"
        [style.filter]="'drop-shadow(0 0 4px ' + m.color + '66)'"
        aria-hidden="true"
      />
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
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 28%, #2d1a4e 0%, #10081b 100%);
        border: 1.5px solid;
        flex-shrink: 0;
      }

      .blip-png {
        width: 66%;
        height: 66%;
        object-fit: contain;
        display: block;
        pointer-events: none;
      }

      .blip-lucide,
      .blip-glyph {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        flex-shrink: 0;
      }
    `,
  ],
})
export class PoiBlipIconComponent {
  readonly category = input.required<string>();
  readonly itemName = input<string>('');
  readonly iconName = input<string>('');
  readonly size = input<number>(28);
  readonly variant = input<'badge' | 'glyph'>('badge');

  readonly resolvedIconUrl = computed(() => getPoiIconUrl(this.iconName()));

  readonly meta = computed(() => {
    const name = this.itemName();
    return name ? getPoiItemMeta(this.category(), name) : getPoiCategoryMeta(this.category());
  });
}
