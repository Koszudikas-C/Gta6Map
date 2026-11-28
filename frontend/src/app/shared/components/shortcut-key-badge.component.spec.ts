import { TestBed } from '@angular/core/testing';
import { ShortcutKeyBadgeComponent } from './shortcut-key-badge.component';

describe('ShortcutKeyBadgeComponent', () => {
  it('renders PlayStation SVG icons with accessible sr-only text', () => {
    const fixture = TestBed.createComponent(ShortcutKeyBadgeComponent);
    for (const key of ['✕', '○', '□', '△', 'D-Pad']) {
      fixture.componentRef.setInput('key', key);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('svg')).not.toBeNull();
      expect(el.textContent?.trim()).toBe(key);
    }
  });

  it('renders Xbox, shoulder/trigger, and desktop keycaps', () => {
    const fixture = TestBed.createComponent(ShortcutKeyBadgeComponent);
    for (const key of ['L1', 'R2', 'L3', 'LB', 'RT', 'Options', 'ESC']) {
      fixture.componentRef.setInput('key', key);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.skb-pill')?.getAttribute('data-key')).toBe(key);
      expect(el.textContent?.trim()).toBe(key);
    }
  });
});
