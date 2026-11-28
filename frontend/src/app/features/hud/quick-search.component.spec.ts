import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickSearchComponent } from './quick-search.component';

describe('QuickSearchComponent', () => {
  let fixture: ComponentFixture<QuickSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickSearchComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickSearchComponent);
    fixture.detectChanges();
  });

  it('keeps the 3D stage in the DOM and toggles .is-collapsed like the tactical panel', () => {
    const root = fixture.nativeElement as HTMLElement;
    const stage = root.querySelector('.quick-search-stage');
    const bar = root.querySelector('.quick-search-bar');

    expect(stage).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(bar?.querySelectorAll('.qs-fold')).toHaveLength(3);
    expect(bar?.querySelector('.qs-fold-1')).not.toBeNull();
    expect(bar?.querySelector('.qs-fold-2')).not.toBeNull();
    expect(bar?.querySelector('.qs-fold-3')).not.toBeNull();
    expect(bar?.classList.contains('is-collapsed')).toBe(true);
    expect(bar?.getAttribute('aria-hidden')).toBe('true');

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(bar?.classList.contains('is-collapsed')).toBe(false);
    expect(bar?.getAttribute('aria-hidden')).toBe('false');

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    expect(bar?.classList.contains('is-collapsed')).toBe(true);
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
  });

  it('navigates visible results with ArrowDown/ArrowUp and selects with Enter even when focus is on container or tabs', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const selectSpy = jest.fn();
    fixture.componentInstance.selectPoi.subscribe(selectSpy);

    const bar = (fixture.nativeElement as HTMLElement).querySelector('.quick-search-bar') as HTMLElement;
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(fixture.componentInstance.highlightedIndex()).toBe(0);

    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(fixture.componentInstance.highlightedIndex()).toBe(1);

    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(fixture.componentInstance.highlightedIndex()).toBe(0);

    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });
});
