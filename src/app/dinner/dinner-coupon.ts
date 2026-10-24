import { Component, computed, inject } from '@angular/core';
import { BUDGETS, Dinner, FOOD_TYPES, typicalSpend } from './dinner';

/** The dinner half of Kain + Nood: a food coupon clipped under the movie ticket. */
@Component({
  selector: 'app-dinner-coupon',
  template: `
    <section class="coupon" aria-label="Dinner pick">
      <header>
        <span class="kicker">Dinner · Kain + Nood</span>
        <button
          type="button"
          class="icon-btn"
          aria-label="Pick another place"
          title="Pick another place"
          (click)="dinner.reroll()"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </header>

      @if (dinner.current(); as p) {
        <div class="place" aria-live="polite">
          <span class="emoji" aria-hidden="true">{{ p.emoji }}</span>
          <div>
            <h3>{{ p.name }}</h3>
            <p>Around ₱{{ spend() }} · try {{ p.picks[0] }}</p>
          </div>
        </div>
      } @else {
        <p class="none">Nothing fits that budget. Try another one.</p>
      }

      <div class="prefs">
        <div class="seg" role="group" aria-label="Food type">
          @for (t of types; track t.id) {
            <button
              type="button"
              [attr.aria-pressed]="dinner.type() === t.id"
              (click)="dinner.setType(t.id)"
            >
              {{ t.label }}
            </button>
          }
        </div>
        <label class="budget">
          <span class="visually-hidden">Budget per person</span>
          <select #b [value]="dinner.budget()" (change)="dinner.setBudget($any(b.value))">
            @for (o of budgets; track o.id) {
              <option [value]="o.id">{{ o.label }}</option>
            }
          </select>
        </label>
      </div>
      <a class="wte" href="https://whattoeat.jsalonga.dev" target="_blank" rel="noopener">
        Spin it in What to Eat ↗
      </a>
    </section>
  `,
  styles: `
    .coupon {
      --paper: oklch(0.88 0.09 80);
      --ink: oklch(0.24 0.04 60);
      display: grid;
      gap: 10px;
      padding: 14px 16px 14px;
      color: var(--ink);
      background: var(--paper);
      border-radius: 12px;
      /* Punched like a coupon: a notch on each side. */
      mask:
        radial-gradient(circle at 0 50%, transparent 9px, #000 9.5px) left / 51% 100% no-repeat,
        radial-gradient(circle at 100% 50%, transparent 9px, #000 9.5px) right / 51% 100% no-repeat;
      filter: drop-shadow(0 8px 18px oklch(0.05 0.02 275 / 0.45));
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1.5px dashed color-mix(in oklch, var(--ink) 45%, transparent);
    }
    .kicker {
      font: 600 0.64rem/1 var(--mono);
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .icon-btn {
      appearance: none;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      margin: -10px -10px -10px 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink);
      cursor: pointer;
      transition: background-color 150ms var(--ease-out);
      &:hover {
        background: color-mix(in oklch, var(--ink) 10%, transparent);
      }
      &:active svg {
        rotate: 90deg;
        transition: rotate 200ms var(--ease-out);
      }
    }
    .place {
      display: flex;
      gap: 12px;
      align-items: center;
      .emoji {
        font-size: 2rem;
        line-height: 1;
      }
      h3 {
        margin: 0;
        font: 900 1.4rem/1 var(--display);
        text-transform: uppercase;
        overflow-wrap: break-word;
      }
      p {
        margin: 4px 0 0;
        font: 500 0.82rem/1.3 var(--body);
      }
    }
    .none {
      margin: 0;
      font: 500 0.85rem/1.3 var(--body);
    }
    .prefs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .seg {
      display: flex;
      flex: 1 1 auto;
      border: 1.5px solid color-mix(in oklch, var(--ink) 35%, transparent);
      border-radius: 8px;
      padding: 2px;
      button {
        flex: 1;
        appearance: none;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--ink);
        font: 600 0.78rem/1 var(--body);
        padding: 0.55rem 0.5rem;
        min-height: 36px;
        cursor: pointer;
      }
      button[aria-pressed='true'] {
        background: var(--ink);
        color: var(--paper);
      }
    }
    .budget select {
      appearance: none;
      height: 100%;
      min-height: 40px;
      border: 1.5px solid color-mix(in oklch, var(--ink) 35%, transparent);
      border-radius: 8px;
      background: transparent;
      color: var(--ink);
      font: 600 0.78rem/1 var(--body);
      padding: 0 0.7rem;
      cursor: pointer;
    }
    .wte {
      justify-self: start;
      color: var(--ink);
      font: 700 0.8rem/1 var(--body);
      text-underline-offset: 3px;
      padding: 6px 0;
    }
  `,
})
export class DinnerCoupon {
  protected readonly dinner = inject(Dinner);
  protected readonly types = FOOD_TYPES;
  protected readonly budgets = BUDGETS;
  protected readonly spend = computed(() => {
    const p = this.dinner.current();
    return p ? typicalSpend(p) : 0;
  });
}
