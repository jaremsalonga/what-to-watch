import { TestBed } from '@angular/core/testing';
import { Api } from './api';
import { Picker } from './picker';
import { AppState } from './state';
import type { Title } from './types';

const film = (id: number, genres: number[]): Title => ({
  id,
  type: 'movie',
  title: `Film ${id}`,
  overview: '',
  poster: '/p.jpg',
  backdrop: null,
  year: 2020,
  rating: 7,
  votes: 100,
  genres,
  lang: 'en',
});

describe('Picker: rolls that lean on loved films', () => {
  let keys: string[];
  beforeEach(() => {
    localStorage.clear();
    keys = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Api,
          useValue: {
            token: null,
            pull: async (key: string) => {
              keys.push(key);
              return { page: 1, totalPages: 1, totalResults: 1, results: [film(2, [878])] };
            },
          },
        },
      ],
    });
    const state = TestBed.inject(AppState);
    state.seen.set([
      {
        id: 1,
        type: 'movie',
        title: 'Arrival',
        poster: null,
        at: 1,
        genres: [878, 18],
        liked: true,
      },
    ]);
  });

  it('asks for the loved film genres and says which film it leaned on', async () => {
    const res = await TestBed.inject(Picker).pull(() => 0.1);
    expect(res.because).toBe('Arrival');
    expect(keys[0]).toContain('878');
  });

  it('rolls normally the other half of the time, or when a genre is already picked', async () => {
    const picker = TestBed.inject(Picker);
    expect((await picker.pull(() => 0.9)).because).toBeUndefined();
    TestBed.inject(AppState).patchFilters({ genres: [35] });
    expect((await picker.pull(() => 0.1)).because).toBeUndefined();
  });
});
