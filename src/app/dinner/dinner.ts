import { effect, Injectable, signal } from '@angular/core';
import { load, save } from '../core/storage';
import { PLACES, type FoodType, type Place } from './places';

export type Budget = 'any' | 'low' | 'mid';

interface DinnerPrefs {
  on: boolean;
  type: FoodType;
  budget: Budget;
  /** The place on the current ticket. */
  current: string | null;
}

const KEY = 'wtw:dinner';
/** Upper limit of typical spend per person, in PHP. */
export const BUDGETS: { id: Budget; label: string; max: number }[] = [
  { id: 'any', label: 'Any budget', max: Infinity },
  { id: 'low', label: 'Under ₱200', max: 200 },
  { id: 'mid', label: 'Under ₱400', max: 400 },
];
export const FOOD_TYPES: { id: FoodType; label: string }[] = [
  { id: 'meal', label: 'Meal' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'pastries', label: 'Pastries' },
];

/** What a person usually spends, as What to Eat counts it: a third of the way up the range. */
export const typicalSpend = (p: Place) => Math.round(p.priceMin + (p.priceMax - p.priceMin) / 3);

/**
 * Dinner and a movie: with "Dinner too" on, every roll also picks a place to eat from What to Eat's
 * chains, shown as a coupon under the ticket with its own reroll.
 */
@Injectable({ providedIn: 'root' })
export class Dinner {
  private readonly initial = load<DinnerPrefs>(KEY, {
    on: false,
    type: 'meal',
    budget: 'any',
    current: null,
  });
  readonly on = signal(this.initial.on);
  readonly type = signal<FoodType>(this.initial.type);
  readonly budget = signal<Budget>(this.initial.budget);
  readonly current = signal<Place | null>(
    PLACES.find((p) => p.id === this.initial.current) ?? null,
  );

  constructor() {
    effect(() =>
      save(KEY, {
        on: this.on(),
        type: this.type(),
        budget: this.budget(),
        current: this.current()?.id ?? null,
      } satisfies DinnerPrefs),
    );
  }

  toggle() {
    this.on.set(!this.on());
    this.current.set(this.on() ? this.pick() : null);
  }

  /** Called with each new ticket: a fresh place when dinner is on, nothing otherwise. */
  forNewTicket(random = Math.random) {
    this.current.set(this.on() ? this.pick(random) : null);
  }

  reroll(random = Math.random) {
    this.current.set(this.pick(random, this.current()?.id));
  }

  setType(t: FoodType) {
    this.type.set(t);
    this.reroll();
  }
  setBudget(b: Budget) {
    this.budget.set(b);
    this.reroll();
  }

  /** A random place for the chosen type and budget, never the one just shown. */
  pick(random = Math.random, not?: string): Place | null {
    const max = BUDGETS.find((b) => b.id === this.budget())!.max;
    const fits = PLACES.filter((p) => p.types.includes(this.type()) && typicalSpend(p) <= max);
    const pool = fits.length > 1 ? fits.filter((p) => p.id !== not) : fits;
    return pool.length ? pool[Math.floor(random() * pool.length)] : null;
  }
}
