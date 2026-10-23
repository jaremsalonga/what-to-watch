import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    );
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('asks for a name on first visit', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('What should');
  });
});
