import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Layers,
  LucideAngularModule,
  MapPin,
  Search,
  Trash2,
  X,
} from 'lucide-angular';
import { LeonidaPoi } from '../../core/data/leonida-map.data';
import { getPoiCategoryMeta } from '../../core/data/poi-category-icons';
import { MapService } from '../../core/services/map.service';
import { PlatformContextService } from '../../core/services/platform-context.service';
import { PoiBlipIconComponent } from '../../shared/components/poi-blip-icon.component';
import { ShortcutKeyBadgeComponent } from '../../shared/components/shortcut-key-badge.component';

const RECENT_POIS_KEY = 'leonida_recent_pois';
const POI_HITS_KEY = 'leonida_poi_hits';
const HIDE_OTHERS_KEY = 'leonida_qs_hide_others';

function loadHideOthersPref(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  try {
    return localStorage.getItem(HIDE_OTHERS_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadRecentPois(): LeonidaPoi[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(RECENT_POIS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadPoiHits(): Record<string, number> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(POI_HITS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

@Component({
  selector: 'app-quick-search',
  standalone: true,
  imports: [LucideAngularModule, PoiBlipIconComponent, ShortcutKeyBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quick-search-stage">
      <div
        class="quick-search-bar"
        [class.is-collapsed]="!isOpen()"
        [attr.aria-hidden]="!isOpen()"
        (keydown)="onKeyDown($event)"
        role="search"
        aria-label="Busca rápida"
      >
        <div class="qs-watermark" aria-hidden="true">VI</div>

        <div class="qs-fold qs-fold-1">
          <div class="qs-input-box">
          <lucide-icon [img]="icons.Search" [size]="16" [strokeWidth]="1.85" class="qs-search-icon" />
          <input
            #quickSearchInput
            type="search"
            class="qs-input"
            [placeholder]="placeholder()"
            [value]="query()"
            (input)="onInput($event)"
            aria-label="Buscar pontos de interesse"
          />
          @if (query().length > 0) {
            <button
              type="button"
              class="qs-clear-btn"
              (click)="clearQuery()"
              aria-label="Limpar busca"
              title="Limpar"
            >
              <lucide-icon [img]="icons.X" [size]="13" [strokeWidth]="2" />
            </button>
          }
          <button
            type="button"
            class="qs-kbd"
            (click)="closeSearch.emit()"
            aria-label="Fechar busca"
            [attr.title]="platform.formatWithShortcut('Fechar', 'closeModal')"
          >
            <app-shortcut-key-badge [key]="platform.shortcutKey('closeModal')" />
          </button>
        </div>

        <div class="qs-mode-bar" role="group" aria-label="Comportamento no mapa ao buscar">
          <span class="qs-mode-label">No mapa:</span>
          <div class="qs-mode-switch">
            @if (!platform.isMobile()) {
              <app-shortcut-key-badge [key]="platform.shortcutKey('toggleMapMode')" />
            }
            <button
              type="button"
              class="qs-mode-btn"
              [class.is-active]="!hideOtherPois()"
              (click)="setHideOtherPois(false)"
            >
              Só ir ao local
            </button>
            <button
              type="button"
              class="qs-mode-btn"
              [class.is-active]="hideOtherPois()"
              (click)="setHideOtherPois(true)"
            >
              Ocultar outros
            </button>
          </div>
        </div>
        </div>

        <div class="qs-fold qs-fold-2">
        @if (query().trim().length > 0) {
          <div class="qs-meta-bar">
            <span>{{ searchResults().length }} resultado(s)</span>
            <button type="button" class="qs-meta-link" (click)="clearQuery()">Limpar filtro</button>
          </div>

          @if (groupedSearchResults().length > 0) {
            <div class="qs-body" role="listbox" aria-label="Resultados da busca">
              @for (group of groupedSearchResults(); track group.category) {
                <section class="qs-group">
                  <div class="qs-group-header">
                    <app-poi-blip-icon [category]="group.category" [size]="20" variant="badge" />
                    <span class="qs-group-title">{{ group.category }}</span>
                    <span class="qs-group-count">{{ group.items.length }}</span>
                  </div>
                  <ul class="qs-list">
                    @for (poi of group.items; track poi.id) {
                      <li>
                        <button
                          type="button"
                          class="qs-item"
                          [class.is-highlighted]="isPoiHighlighted(poi)"
                          (click)="choosePoi(poi)"
                        >
                          <app-poi-blip-icon [category]="poi.category" [itemName]="poi.name" [size]="30" variant="badge" />
                          <div class="qs-item-info">
                            <span class="qs-item-name">{{ poi.name }}</span>
                            <span class="qs-item-region">{{ poi.region }}</span>
                          </div>
                          <lucide-icon [img]="icons.ChevronRight" [size]="14" [strokeWidth]="1.75" class="qs-chevron" />
                        </button>
                      </li>
                    }
                  </ul>
                </section>
              }
            </div>
          } @else {
            <div class="qs-empty">
              <lucide-icon [img]="icons.MapPin" [size]="20" [strokeWidth]="1.6" />
              <p>Nenhum local encontrado para "{{ query() }}"</p>
            </div>
          }
        } @else {
          <div class="qs-tabs" role="tablist" aria-label="Navegação rápida">
            @if (!platform.isMobile()) {
              <app-shortcut-key-badge [key]="platform.shortcutKey('cycleSearchTab')" />
            }
            <button
              type="button"
              role="tab"
              class="qs-tab"
              [class.is-active]="activeTab() === 'categories'"
              [attr.aria-selected]="activeTab() === 'categories'"
              (click)="activeTab.set('categories'); highlightedIndex.set(-1)"
            >
              <lucide-icon [img]="icons.Layers" [size]="13" [strokeWidth]="1.8" />
              <span>Categorias</span>
              <span class="qs-tab-badge">{{ allCategoryGroups().length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              class="qs-tab"
              [class.is-active]="activeTab() === 'recent'"
              [attr.aria-selected]="activeTab() === 'recent'"
              (click)="activeTab.set('recent'); highlightedIndex.set(-1)"
            >
              <lucide-icon [img]="icons.Clock" [size]="13" [strokeWidth]="1.8" />
              <span>Recentes</span>
              <span class="qs-tab-badge">{{ recentPois().length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              class="qs-tab"
              [class.is-active]="activeTab() === 'popular'"
              [attr.aria-selected]="activeTab() === 'popular'"
              (click)="activeTab.set('popular'); highlightedIndex.set(-1)"
            >
              <lucide-icon [img]="icons.Flame" [size]="13" [strokeWidth]="1.8" />
              <span>Acessados</span>
              <span class="qs-tab-badge">{{ popularPois().length }}</span>
            </button>
          </div>

          @if (activeTab() === 'categories') {
            <div class="qs-cat-pills-wrap">
              <button
                type="button"
                class="qs-pills-nav is-prev"
                (click)="scrollPills(pillsRow, -1)"
                aria-label="Categorias anteriores"
                title="Anterior"
              >
                @if (!platform.isMobile()) {
                  <app-shortcut-key-badge [key]="platform.shortcutKey('scrollCatPrev')" />
                } @else {
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M10.5 3L5.5 8L10.5 13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M14 5L11 8L14 11" stroke="#FFB458" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
              </button>
              <div
                #pillsRow
                class="qs-cat-pills"
                role="group"
                aria-label="Filtrar por categoria"
                (wheel)="onPillsWheel($event)"
              >
                <button
                  type="button"
                  class="qs-cat-pill"
                  [class.is-active]="selectedCategoryFilter() === 'Todas'"
                  (click)="selectedCategoryFilter.set('Todas'); highlightedIndex.set(-1)"
                >
                  <span>Todas</span>
                </button>
                @for (group of allCategoryGroups(); track group.category) {
                  <button
                    type="button"
                    class="qs-cat-pill"
                    [class.is-active]="selectedCategoryFilter() === group.category"
                    (click)="selectedCategoryFilter.set(group.category); highlightedIndex.set(-1)"
                  >
                    <app-poi-blip-icon [category]="group.category" [size]="13" variant="glyph" />
                    <span>{{ group.category }}</span>
                    <span class="qs-pill-count">{{ group.items.length }}</span>
                  </button>
                }
              </div>
              <button
                type="button"
                class="qs-pills-nav is-next"
                (click)="scrollPills(pillsRow, 1)"
                aria-label="Próximas categorias"
                title="Próximo"
              >
                @if (!platform.isMobile()) {
                  <app-shortcut-key-badge [key]="platform.shortcutKey('scrollCatNext')" />
                } @else {
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M5.5 3L10.5 8L5.5 13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M2 5L5 8L2 11" stroke="#FFB458" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
              </button>
            </div>

            <div class="qs-body" role="listbox" aria-label="Locais por categoria">
              @for (group of filteredCategoryGroups(); track group.category) {
                <section class="qs-group" [attr.data-category]="group.category">
                  <div class="qs-group-header">
                    <app-poi-blip-icon [category]="group.category" [size]="20" variant="badge" />
                    <span class="qs-group-title">{{ group.category }}</span>
                    <span class="qs-group-count">{{ group.items.length }}</span>
                    @if (selectedCategoryFilter() === 'Todas' && group.items.length > 3) {
                      <button
                        type="button"
                        class="qs-expand-pill"
                        (click)="toggleCategoryExpand(group.category)"
                      >
                        {{
                          expandedCategories()[group.category]
                            ? 'Recolher'
                            : 'Ver todos (+' + (group.items.length - 3) + ')'
                        }}
                      </button>
                    }
                  </div>
                  <ul class="qs-list">
                    @for (poi of getVisibleItemsForGroup(group); track poi.id) {
                      <li>
                        <button
                          type="button"
                          class="qs-item"
                          [class.is-highlighted]="isPoiHighlighted(poi)"
                          (click)="choosePoi(poi)"
                        >
                          <app-poi-blip-icon [category]="poi.category" [itemName]="poi.name" [size]="30" variant="badge" />
                          <div class="qs-item-info">
                            <span class="qs-item-name">{{ poi.name }}</span>
                            <span class="qs-item-region">{{ poi.region }}</span>
                          </div>
                          <lucide-icon [img]="icons.ChevronRight" [size]="14" [strokeWidth]="1.75" class="qs-chevron" />
                        </button>
                      </li>
                    }
                  </ul>
                </section>
              }
            </div>
          } @else if (activeTab() === 'recent') {
            @if (recentPois().length > 0) {
              <div class="qs-meta-bar">
                <span>Visitados recentemente</span>
                <button type="button" class="qs-meta-link is-danger" (click)="clearRecent()">
                  <lucide-icon [img]="icons.Trash2" [size]="11" [strokeWidth]="1.9" />
                  <span>Limpar</span>
                </button>
              </div>
              <div class="qs-body" role="listbox" aria-label="Locais recentes">
                <ul class="qs-list">
                  @for (poi of recentPois(); track poi.id) {
                    @let color = getCategoryColor(poi.category);
                    <li>
                      <button
                        type="button"
                        class="qs-item"
                        [class.is-highlighted]="isPoiHighlighted(poi)"
                        (click)="choosePoi(poi)"
                      >
                        <app-poi-blip-icon [category]="poi.category" [itemName]="poi.name" [size]="30" variant="badge" />
                        <div class="qs-item-info">
                          <span class="qs-item-name">{{ poi.name }}</span>
                          <span class="qs-item-region">{{ poi.region }}</span>
                        </div>
                        <span
                          class="qs-cat-tag"
                          [style.color]="color"
                          [style.borderColor]="color + '55'"
                          [style.background]="color + '1A'"
                        >
                          {{ poi.category }}
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              </div>
            } @else {
              <div class="qs-empty">
                <lucide-icon [img]="icons.Clock" [size]="20" [strokeWidth]="1.6" />
                <p>Nenhum local visitado recentemente</p>
                <button
                  type="button"
                  class="qs-action-btn"
                  (click)="activeTab.set('categories')"
                >
                  Explorar por categoria
                </button>
              </div>
            }
          } @else {
            <div class="qs-body" role="listbox" aria-label="Locais mais acessados">
              <ul class="qs-list">
                @for (entry of popularPois(); track entry.poi.id; let idx = $index) {
                  @let color = getCategoryColor(entry.poi.category);
                  <li>
                    <button
                      type="button"
                      class="qs-item"
                      [class.is-highlighted]="isPoiHighlighted(entry.poi)"
                      (click)="choosePoi(entry.poi)"
                    >
                      <span
                        class="qs-rank"
                        [class.rank-1]="idx === 0"
                        [class.rank-2]="idx === 1"
                        [class.rank-3]="idx === 2"
                      >
                        #{{ idx + 1 }}
                      </span>
                      <app-poi-blip-icon [category]="entry.poi.category" [itemName]="entry.poi.name" [size]="28" variant="badge" />
                      <div class="qs-item-info">
                        <span class="qs-item-name">{{ entry.poi.name }}</span>
                        <span class="qs-item-region">{{ entry.poi.region }}</span>
                      </div>
                      <span
                        class="qs-cat-tag"
                        [style.color]="color"
                        [style.borderColor]="color + '55'"
                        [style.background]="color + '1A'"
                      >
                        {{ entry.poi.category }}
                      </span>
                      <span class="qs-hits-badge">
                        {{ entry.hits > 0 ? entry.hits + 'x' : 'Destaque' }}
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
        }
        </div>

        <div class="qs-fold qs-fold-3">
          <div class="qs-footer">
          <div class="qs-footer-hints">
            @if (platform.isMobile()) {
              <span>Toque para selecionar</span>
            } @else {
              <span class="qs-hint-item">
                <app-shortcut-key-badge [key]="platform.shortcutKey('navigateList')" />
                <span>Navegar</span>
              </span>
              <span class="qs-hint-item">
                <app-shortcut-key-badge [key]="platform.shortcutKey('expandToggle')" />
                <span>Ver todos</span>
              </span>
              <span class="qs-hint-item">
                <app-shortcut-key-badge [key]="platform.shortcutKey('closeModal')" />
                <span>Fechar</span>
              </span>
              <span class="qs-hint-item">
                <app-shortcut-key-badge [key]="platform.shortcutKey('focusSearchInput')" />
                <span>Busca</span>
              </span>
              <span class="qs-hint-item">
                <app-shortcut-key-badge [key]="platform.shortcutKey('confirmItem')" />
                <span>Ir</span>
              </span>
            }
          </div>
          <span class="qs-footer-total">{{ totalPoisCount() }} locais</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .quick-search-stage {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        width: min(468px, calc(100dvw - 120px));
        z-index: 40;
        perspective: 1150px;
        perspective-origin: 50% 0%;
        pointer-events: none;
      }

      .quick-search-bar {
        box-sizing: border-box;
        position: relative;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
        border-radius: 16px;
        background: radial-gradient(circle at 50% 0%, rgba(34, 21, 58, 0.96) 0%, rgba(16, 10, 28, 0.96) 100%);
        border: 2px solid #7b208f;
        box-shadow: 0 22px 54px rgba(0, 0, 0, 0.78), 0 0 34px rgba(123, 32, 143, 0.45);
        overflow: hidden;
        transform-style: flat;
        transform-origin: top center;
        backface-visibility: hidden;
        transform: none;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition:
          transform 320ms cubic-bezier(0.22, 1.12, 0.36, 1),
          opacity 200ms ease,
          visibility 0s linear 0ms;
      }

      .qs-fold {
        box-sizing: border-box;
        position: relative;
        width: 100%;
        min-width: 0;
        z-index: 1;
        padding: 12px;
        overflow: hidden;
        transform-origin: top center;
        backface-visibility: hidden;
      }

      .qs-fold::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(6, 3, 14, 0.55) 0%, rgba(6, 3, 14, 0.12) 100%);
        opacity: 0;
        transition: opacity 280ms ease;
        z-index: 2;
      }

      .quick-search-bar.is-collapsed .qs-fold::before {
        opacity: 1;
      }

      .qs-fold-1 {
        border-radius: 14px 14px 0 0;
        transform: none;
        opacity: 1;
        transition:
          transform 340ms cubic-bezier(0.22, 1.08, 0.36, 1) 40ms,
          opacity 200ms ease 40ms;
      }

      .qs-fold-2 {
        padding-top: 10px;
        border-radius: 0;
        border-top: 1px solid rgba(255, 166, 107, 0.16);
        box-shadow: inset 0 6px 10px -8px rgba(0, 0, 0, 0.65);
        transform: none;
        opacity: 1;
        transition:
          transform 380ms cubic-bezier(0.22, 1.12, 0.36, 1) 130ms,
          opacity 220ms ease 110ms;
      }

      .qs-fold-3 {
        padding: 10px 12px;
        border-radius: 0 0 14px 14px;
        border-top: 1px solid rgba(255, 166, 107, 0.16);
        box-shadow: inset 0 6px 10px -8px rgba(0, 0, 0, 0.65);
        transform: none;
        opacity: 1;
        transition:
          transform 400ms cubic-bezier(0.22, 1.14, 0.36, 1) 210ms,
          opacity 240ms ease 180ms;
      }

      .quick-search-bar.is-collapsed .qs-fold-3 {
        transform: rotateX(-105deg) translateY(-100%);
        opacity: 0;
        transition:
          transform 200ms ease-in 0ms,
          opacity 160ms ease 40ms;
      }

      .quick-search-bar.is-collapsed .qs-fold-2 {
        transform: rotateX(105deg) translateY(-100%);
        opacity: 0;
        transition:
          transform 200ms ease-in 80ms,
          opacity 160ms ease 110ms;
      }

      .quick-search-bar.is-collapsed .qs-fold-1 {
        transform: rotateX(-85deg);
        opacity: 0;
        transition:
          transform 200ms ease-in 150ms,
          opacity 160ms ease 170ms;
      }

      .quick-search-bar:not(.is-collapsed) {
        animation:
          quickSearchDrop 280ms cubic-bezier(0.22, 1.12, 0.36, 1) forwards,
          gtaSearchGlow 8s ease-in-out infinite;
      }

      .quick-search-bar.is-collapsed {
        transform-style: preserve-3d;
        transform: rotateX(-68deg) translateY(-14px) scale(0.92);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        animation: none;
        transition:
          transform 220ms cubic-bezier(0.55, 0, 0.8, 0.35),
          opacity 180ms ease 40ms,
          visibility 0s linear 220ms;
      }

      @keyframes gtaSearchGlow {
        0%, 100% {
          border-color: #7b208f;
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.78), 0 0 34px rgba(123, 32, 143, 0.46);
        }
        25% {
          border-color: #c9349b;
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.78), 0 0 38px rgba(201, 52, 155, 0.48);
        }
        50% {
          border-color: #f36a78;
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.78), 0 0 40px rgba(243, 106, 120, 0.5);
        }
        75% {
          border-color: #ff9b55;
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.78), 0 0 38px rgba(255, 155, 85, 0.46);
        }
        90% {
          border-color: #ffb458;
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.78), 0 0 36px rgba(255, 180, 88, 0.44);
        }
      }

      .qs-watermark {
        position: absolute;
        right: 8px;
        bottom: -14px;
        font-family: 'GtaDisplay', var(--font-display);
        font-size: 160px;
        line-height: 0.85;
        background: var(--gradient-signature);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        opacity: 0.06;
        pointer-events: none;
        user-select: none;
      }

      .qs-input-box {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 9px 12px;
        border-radius: 11px;
        background: rgba(10, 6, 18, 0.72);
        border: 1px solid rgba(255, 246, 248, 0.12);
        transition: border-color 140ms ease, box-shadow 140ms ease;
      }

      .qs-input-box:focus-within {
        border-color: rgba(244, 78, 143, 0.7);
        box-shadow: 0 0 0 1px rgba(244, 78, 143, 0.28), 0 0 18px rgba(244, 78, 143, 0.18);
      }

      .qs-search-icon {
        color: #ffb458;
        flex-shrink: 0;
      }

      .qs-input {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: none;
        outline: none;
        color: #fff6f8;
        font-size: 13px;
        font-weight: 500;
      }

      .qs-input:focus,
      .qs-input:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }

      .qs-input::placeholder {
        color: rgba(255, 246, 248, 0.42);
      }

      .qs-input::-webkit-search-cancel-button {
        display: none;
      }

      .qs-clear-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: none;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 246, 248, 0.75);
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
      }

      .qs-clear-btn:hover {
        background: rgba(244, 78, 143, 0.28);
        color: #fff;
      }

      .qs-kbd {
        font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 246, 248, 0.6);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 246, 248, 0.14);
        border-radius: 6px;
        padding: 3px 7px;
        flex-shrink: 0;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
      }

      .qs-kbd:hover {
        color: #fff6f8;
        background: rgba(244, 78, 143, 0.2);
        border-color: rgba(244, 78, 143, 0.45);
      }

      .qs-kbd:focus-visible {
        outline: 2px solid #f44e8f;
        outline-offset: 1px;
      }

      .qs-mode-bar {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 8px;
        padding: 4px 2px 0;
      }

      .qs-mode-label {
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 246, 248, 0.56);
      }

      .qs-mode-switch {
        display: inline-flex;
        padding: 2px;
        border-radius: 8px;
        background: rgba(10, 6, 18, 0.72);
        border: 1px solid rgba(255, 246, 248, 0.1);
        gap: 2px;
      }

      .qs-mode-btn {
        border: 1px solid transparent;
        background: transparent;
        color: rgba(255, 246, 248, 0.65);
        font-size: 10.5px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 120ms ease;
      }

      .qs-mode-btn:hover {
        color: #fff6f8;
      }

      .qs-mode-btn.is-active {
        color: #fff6f8;
        background: linear-gradient(135deg, rgba(244, 78, 143, 0.28) 0%, rgba(255, 166, 107, 0.24) 100%);
        border-color: rgba(255, 180, 88, 0.55);
      }

      .qs-tabs {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 10px;
        padding: 3px;
        border-radius: 10px;
        background: rgba(10, 6, 18, 0.65);
        border: 1px solid rgba(255, 246, 248, 0.08);
      }

      .qs-tab {
        flex: 1;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 6px 8px;
        border-radius: 7px;
        border: 1px solid transparent;
        background: transparent;
        color: rgba(255, 246, 248, 0.64);
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        cursor: pointer;
        transition: all 130ms ease;
      }

      .qs-tab:hover {
        color: #fff6f8;
        background: rgba(255, 255, 255, 0.06);
      }

      .qs-tab.is-active {
        color: #fff6f8;
        background: linear-gradient(135deg, rgba(244, 78, 143, 0.26) 0%, rgba(255, 166, 107, 0.22) 100%);
        border-color: rgba(255, 166, 107, 0.48);
        box-shadow: 0 2px 12px rgba(244, 78, 143, 0.22);
      }

      .qs-tab-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.09);
        color: inherit;
      }

      .qs-cat-pills-wrap {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 9px;
      }

      .qs-pills-nav {
        flex-shrink: 0;
        width: 26px;
        height: 26px;
        border-radius: 7px;
        border: 1px solid rgba(244, 78, 143, 0.38);
        background: linear-gradient(135deg, rgba(244, 78, 143, 0.16) 0%, rgba(255, 180, 88, 0.12) 100%);
        color: #fff6f8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 140ms ease, border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
      }

      .qs-pills-nav:hover {
        background: linear-gradient(135deg, rgba(244, 78, 143, 0.34) 0%, rgba(255, 180, 88, 0.28) 100%);
        border-color: #ffb458;
        box-shadow: 0 0 12px rgba(244, 78, 143, 0.35);
        transform: scale(1.06);
      }

      .qs-cat-pills {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 4px;
        overflow-x: auto;
        scroll-snap-type: x proximity;
        scroll-padding-inline: 4px;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .qs-cat-pills::-webkit-scrollbar {
        display: none;
      }

      .qs-cat-pill {
        flex-shrink: 0;
        scroll-snap-align: start;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255, 246, 248, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 246, 248, 0.72);
        font-size: 10.5px;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
        transition: all 120ms ease;
      }

      .qs-cat-pill:hover {
        color: #fff6f8;
        border-color: rgba(255, 180, 88, 0.4);
        background: rgba(255, 180, 88, 0.1);
      }

      .qs-cat-pill.is-active {
        color: #fff6f8;
        background: linear-gradient(135deg, rgba(244, 78, 143, 0.28) 0%, rgba(255, 166, 107, 0.24) 100%);
        border-color: rgba(255, 180, 88, 0.62);
        box-shadow: 0 0 10px rgba(244, 78, 143, 0.22);
      }

      .qs-pill-count {
        font-size: 9.5px;
        opacity: 0.72;
      }

      .qs-meta-bar {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 9px;
        padding: 0 2px 2px;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255, 246, 248, 0.52);
      }

      .qs-meta-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: none;
        background: transparent;
        color: #ffb458;
        font-size: 10.5px;
        font-weight: 700;
        cursor: pointer;
        padding: 2px 4px;
      }

      .qs-meta-link.is-danger {
        color: #fb7185;
      }

      .qs-body {
        position: relative;
        z-index: 1;
        margin-top: 9px;
        max-height: min(350px, 54dvh);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 11px;
        padding-right: 4px;
      }

      .qs-body::-webkit-scrollbar {
        width: 4px;
      }

      .qs-body::-webkit-scrollbar-button {
        display: none;
        width: 0;
        height: 0;
      }

      .qs-body::-webkit-scrollbar-track {
        background: transparent;
      }

      .qs-body::-webkit-scrollbar-thumb {
        background: rgba(244, 78, 143, 0.36);
        border-radius: 999px;
      }

      .qs-body::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 166, 107, 0.6);
      }

      .qs-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .qs-group-header {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 2px 4px;
      }

      .qs-group-title {
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 246, 248, 0.8);
      }

      .qs-group-count {
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 246, 248, 0.52);
        background: rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        padding: 1px 6px;
      }

      .qs-expand-pill {
        margin-left: auto;
        border: 1px solid rgba(255, 180, 88, 0.35);
        background: rgba(255, 180, 88, 0.12);
        color: #ffb458;
        font-size: 10px;
        font-weight: 700;
        border-radius: 999px;
        padding: 2px 8px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 120ms ease, border-color 120ms ease;
      }

      .qs-expand-pill:hover {
        background: rgba(244, 78, 143, 0.22);
        border-color: rgba(244, 78, 143, 0.55);
        color: #fff6f8;
      }

      .qs-list {
        list-style: none;
        margin: 0;
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .qs-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 246, 248, 0.06);
        background: rgba(255, 255, 255, 0.025);
        color: #fff6f8;
        text-align: left;
        cursor: pointer;
        transition: background 130ms ease, border-color 130ms ease, transform 130ms ease;
      }

      .qs-item:hover,
      .qs-item.is-highlighted {
        background: linear-gradient(90deg, rgba(244, 78, 143, 0.16) 0%, rgba(255, 166, 107, 0.08) 100%);
        border-color: rgba(244, 78, 143, 0.45);
        transform: translateX(2px);
      }

      .qs-item:hover .qs-chevron,
      .qs-item.is-highlighted .qs-chevron {
        color: #ffa66b;
        transform: translateX(2px);
      }

      .qs-item-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .qs-item-name {
        font-size: 12.5px;
        font-weight: 700;
        color: #fff6f8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qs-item-region {
        font-size: 10.5px;
        color: rgba(255, 246, 248, 0.54);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qs-chevron {
        color: rgba(255, 246, 248, 0.35);
        flex-shrink: 0;
        transition: transform 130ms ease, color 130ms ease;
      }

      .qs-cat-tag {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 700;
        border: 1px solid;
        border-radius: 999px;
        padding: 2px 8px;
        white-space: nowrap;
      }

      .qs-rank {
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 800;
        color: rgba(255, 246, 248, 0.6);
        width: 24px;
        text-align: center;
      }

      .qs-rank.rank-1 {
        color: #ffb458;
      }

      .qs-rank.rank-2 {
        color: #f44e8f;
      }

      .qs-rank.rank-3 {
        color: #4ce0d2;
      }

      .qs-hits-badge {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 246, 248, 0.65);
        background: rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        padding: 2px 6px;
      }

      .qs-empty {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 24px 12px 16px;
        text-align: center;
        color: rgba(255, 246, 248, 0.56);
        font-size: 12px;
      }

      .qs-empty p {
        margin: 0;
      }

      .qs-action-btn {
        border: 1px solid rgba(255, 180, 88, 0.45);
        background: rgba(255, 180, 88, 0.14);
        color: #ffb458;
        font-size: 11.5px;
        font-weight: 700;
        border-radius: 8px;
        padding: 6px 12px;
        cursor: pointer;
      }

      .qs-footer {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0;
        padding-top: 0;
        border-top: none;
        font-size: 10px;
        font-weight: 600;
        color: rgba(255, 246, 248, 0.46);
      }

      .qs-footer-hints {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }

      .qs-hint-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .qs-footer-total {
        color: #ffb458;
        font-weight: 700;
      }

      @keyframes quickSearchDrop {
        from {
          opacity: 0;
          transform: rotateX(-68deg) translateY(-10px) scale(0.94);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .quick-search-bar,
        .quick-search-bar.is-collapsed {
          transition: opacity 150ms ease !important;
          animation: none !important;
        }
      }

      @media (max-width: 767px) {
        .quick-search-stage {
          top: 68px;
          width: min(360px, calc(100dvw - 24px));
        }

        .qs-body {
          max-height: min(300px, 50dvh);
        }
      }
    `,
  ],
})
export class QuickSearchComponent {
  private readonly mapService = inject(MapService);
  readonly platform = inject(PlatformContextService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('quickSearchInput');

  readonly isOpen = input(false);
  readonly query = input('');
  readonly placeholder = input('Buscar locais, bairros ou categorias...');

  readonly queryChange = output<string>();
  readonly selectPoi = output<LeonidaPoi>();
  readonly closeSearch = output<void>();
  readonly hideOtherPoisChange = output<boolean>();

  readonly totalPoisCount = this.mapService.totalPoisCount;
  readonly hideOtherPois = signal<boolean>(loadHideOthersPref());
  readonly activeTab = signal<'categories' | 'recent' | 'popular'>('categories');
  readonly selectedCategoryFilter = signal<string>('Todas');
  readonly expandedCategories = signal<Record<string, boolean>>({});
  readonly highlightedIndex = signal(-1);
  readonly recentPois = signal<LeonidaPoi[]>(loadRecentPois());
  readonly poiHits = signal<Record<string, number>>(loadPoiHits());

  readonly icons = {
    Search,
    X,
    Clock,
    Flame,
    Layers,
    MapPin,
    ChevronLeft,
    ChevronRight,
    Trash2,
  };

  readonly allCategoryGroups = computed(() => this.mapService.groupedPoisByCategory());

  readonly filteredCategoryGroups = computed(() => {
    const selected = this.selectedCategoryFilter();
    if (selected === 'Todas') {
      return this.allCategoryGroups();
    }
    const items = this.mapService.getPoisByCategory(selected);
    return items.length > 0 ? [{ category: selected, items }] : [];
  });

  readonly searchResults = computed(() =>
    this.mapService.searchPoisFast(this.query(), 'Todas', 30),
  );

  readonly groupedSearchResults = computed(() => {
    const groups = new Map<string, LeonidaPoi[]>();
    for (const poi of this.searchResults()) {
      let bucket = groups.get(poi.category);
      if (!bucket) {
        bucket = [];
        groups.set(poi.category, bucket);
      }
      bucket.push(poi);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  });

  readonly popularPois = computed(() => {
    const hits = this.poiHits();
    const recent = this.recentPois();
    const featured = this.mapService.getFeaturedPois(12);
    const pool = new Map<string, LeonidaPoi>();
    for (const poi of [...recent, ...featured]) {
      pool.set(poi.id, poi);
    }
    return Array.from(pool.values())
      .map((poi) => ({ poi, hits: hits[poi.id] ?? 0 }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 8);
  });

  readonly visibleFlatItems = computed<LeonidaPoi[]>(() => {
    if (this.query().trim().length > 0) {
      return this.groupedSearchResults().flatMap((g) => g.items);
    }
    const tab = this.activeTab();
    if (tab === 'categories') {
      return this.filteredCategoryGroups().flatMap((g) => this.getVisibleItemsForGroup(g));
    }
    if (tab === 'recent') {
      return this.recentPois();
    }
    return this.popularPois().map((entry) => entry.poi);
  });

  focusInput(): void {
    this.highlightedIndex.set(-1);
    const inputEl = this.searchInput()?.nativeElement;
    if (!inputEl) {
      return;
    }
    if (typeof document !== 'undefined') {
      for (const prev of Array.from(document.querySelectorAll('.gamepad-focus'))) {
        prev.classList.remove('gamepad-focus');
      }
      if (this.platform.isConsole()) {
        inputEl.classList.add('gamepad-focus');
      }
    }
    inputEl.focus();
    inputEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private readonly pillsRow = viewChild<ElementRef<HTMLElement>>('pillsRow');

  toggleHideOthers(): void {
    this.setHideOtherPois(!this.hideOtherPois());
    setTimeout(() => this.focusMatchingControl('.qs-mode-btn.is-active'), 0);
  }

  cycleTab(): void {
    const order: Array<'categories' | 'recent' | 'popular'> = ['categories', 'recent', 'popular'];
    const next = order[(order.indexOf(this.activeTab()) + 1) % order.length];
    this.activeTab.set(next);
    this.highlightedIndex.set(-1);
    setTimeout(() => this.focusMatchingControl('.qs-tab.is-active'), 0);
  }

  private focusMatchingControl(selector: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const el = document.querySelector(`.quick-search-bar ${selector}`) as HTMLElement | null;
    if (!el) {
      return;
    }
    for (const prev of Array.from(document.querySelectorAll('.gamepad-focus'))) {
      prev.classList.remove('gamepad-focus');
    }
    if (this.platform.isConsole()) {
      el.classList.add('gamepad-focus');
    }
    el.focus({ preventScroll: false });
  }

  scrollCategories(direction: -1 | 1): void {
    const categories = ['Todas', ...this.allCategoryGroups().map((g) => g.category)];
    if (categories.length === 0) {
      return;
    }
    const currentIdx = categories.indexOf(this.selectedCategoryFilter());
    const nextIdx =
      currentIdx === -1
        ? 0
        : (currentIdx + direction + categories.length) % categories.length;
    this.selectedCategoryFilter.set(categories[nextIdx]);
    this.highlightedIndex.set(-1);

    setTimeout(() => {
      const el = document.querySelector('.quick-search-bar .qs-cat-pill.is-active') as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      this.focusMatchingControl('.qs-cat-pill.is-active');
    }, 0);
  }

  toggleActiveGroupExpand(): void {
    if (typeof document === 'undefined' || this.activeTab() !== 'categories') {
      return;
    }
    const focused =
      (document.querySelector('.quick-search-bar .gamepad-focus') as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
    const groupCat = focused?.closest('.qs-group')?.getAttribute('data-category');
    const targetCategory =
      groupCat ??
      this.filteredCategoryGroups().find((g) => g.items.length > 3)?.category ??
      null;
    if (targetCategory) {
      this.toggleCategoryExpand(targetCategory);
    }
  }

  scrollPills(el: HTMLElement, direction: -1 | 1): void {
    const step = Math.max(120, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  setHideOtherPois(hide: boolean): void {
    this.hideOtherPois.set(hide);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(HIDE_OTHERS_KEY, String(hide));
      } catch {}
    }
    this.hideOtherPoisChange.emit(hide);
  }

  onPillsWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaY) > 0) {
      event.preventDefault();
      (event.currentTarget as HTMLElement).scrollLeft += event.deltaY;
    }
  }

  getCategoryColor(category: string): string {
    return getPoiCategoryMeta(category).color;
  }

  getVisibleItemsForGroup(group: { category: string; items: LeonidaPoi[] }): LeonidaPoi[] {
    if (this.selectedCategoryFilter() !== 'Todas' || this.expandedCategories()[group.category]) {
      return group.items;
    }
    return group.items.slice(0, 3);
  }

  toggleCategoryExpand(category: string): void {
    const willCollapse = Boolean(this.expandedCategories()[category]);
    this.expandedCategories.update((state) => ({
      ...state,
      [category]: !state[category],
    }));
    if (willCollapse && typeof document !== 'undefined') {
      setTimeout(() => {
        const group = Array.from(document.querySelectorAll('.quick-search-bar .qs-group')).find(
          (el) => el.getAttribute('data-category') === category,
        );
        const items = group?.querySelectorAll<HTMLElement>('.qs-item');
        const lastItem = items && items.length > 0 ? items[items.length - 1] : null;
        if (!lastItem) {
          return;
        }
        for (const prev of Array.from(document.querySelectorAll('.gamepad-focus'))) {
          prev.classList.remove('gamepad-focus');
        }
        if (this.platform.isConsole()) {
          lastItem.classList.add('gamepad-focus');
        }
        lastItem.focus({ preventScroll: false });
        lastItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }, 0);
    }
  }

  isPoiHighlighted(poi: LeonidaPoi): boolean {
    const idx = this.highlightedIndex();
    if (idx < 0) {
      return false;
    }
    const flat = this.visibleFlatItems();
    return flat[idx]?.id === poi.id;
  }

  onInput(event: Event): void {
    this.highlightedIndex.set(-1);
    const target = event.target as HTMLInputElement;
    this.queryChange.emit(target.value);
  }

  clearQuery(): void {
    this.highlightedIndex.set(-1);
    this.queryChange.emit('');
    setTimeout(() => this.focusInput(), 0);
  }

  onKeyDown(event: KeyboardEvent): void {
    const items = this.visibleFlatItems();
    if (event.key === 'ArrowDown') {
      if (items.length === 0) return;
      event.preventDefault();
      this.highlightedIndex.update((i) => (i + 1) % items.length);
      this.scrollHighlightedItemIntoView();
    } else if (event.key === 'ArrowUp') {
      if (items.length === 0) return;
      event.preventDefault();
      this.highlightedIndex.update((i) => (i <= 0 ? items.length - 1 : i - 1));
      this.scrollHighlightedItemIntoView();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const isInputWithText =
        event.target instanceof HTMLInputElement && event.target.value.length > 0;
      if (!isInputWithText && this.query().trim().length === 0 && this.activeTab() === 'categories') {
        event.preventDefault();
        this.scrollCategories(event.key === 'ArrowLeft' ? -1 : 1);
      }
    } else if (event.key === 'Enter') {
      if (event.target instanceof HTMLButtonElement && this.highlightedIndex() < 0) {
        return;
      }
      if (items.length === 0) return;
      event.preventDefault();
      const idx = this.highlightedIndex();
      const target = idx >= 0 && idx < items.length ? items[idx] : items[0];
      this.choosePoi(target);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch.emit();
    }
  }

  private scrollHighlightedItemIntoView(): void {
    if (typeof document === 'undefined') {
      return;
    }
    setTimeout(() => {
      document
        .querySelector('.quick-search-bar .qs-item.is-highlighted')
        ?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  choosePoi(poi: LeonidaPoi): void {
    this.recordPoiAccess(poi);
    this.selectPoi.emit(poi);
  }

  clearRecent(): void {
    this.recentPois.set([]);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(RECENT_POIS_KEY);
      } catch {}
    }
  }

  private recordPoiAccess(poi: LeonidaPoi): void {
    const nextRecent = [poi, ...this.recentPois().filter((p) => p.id !== poi.id)].slice(0, 8);
    this.recentPois.set(nextRecent);
    const nextHits = { ...this.poiHits(), [poi.id]: (this.poiHits()[poi.id] ?? 0) + 1 };
    this.poiHits.set(nextHits);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(RECENT_POIS_KEY, JSON.stringify(nextRecent));
        localStorage.setItem(POI_HITS_KEY, JSON.stringify(nextHits));
      } catch {}
    }
  }
}
