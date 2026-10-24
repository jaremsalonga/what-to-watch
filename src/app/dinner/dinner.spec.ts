import { TestBed } from '@angular/core/testing';
import { Dinner, typicalSpend } from './dinner';
import { PLACES } from './places';

describe('Dinner', () => {
  beforeEach(() => localStorage.clear());
  const make = () => TestBed.inject(Dinner);

  it('picks nothing while off, and a place of the chosen type once on', () => {
    const d = make();
    d.forNewTicket();
    expect(d.current()).toBeNull();
    d.toggle();
    d.setType('dessert');
    d.forNewTicket();
    expect(d.current()?.types).toContain('dessert');
  });

  it('respects the budget and never repeats the place it is replacing', () => {
    const d = make();
    d.toggle();
    d.setBudget('low');
    for (let i = 0; i < 20; i++) {
      const before = d.current()?.id;
      d.reroll();
      expect(typicalSpend(d.current()!)).toBeLessThanOrEqual(200);
      expect(d.current()!.id).not.toBe(before);
    }
  });

  it('has a usable copy of the What to Eat chains', () => {
    expect(PLACES.length).toBeGreaterThan(30);
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
  });
});
