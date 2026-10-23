import { Component } from '@angular/core';
import { CONTACT_EMAIL, contactUrl } from '../core/links';

@Component({
  selector: 'app-about',
  template: `
    <h1 class="h">About</h1>
    <p>
      What to Watch? is a little ticket booth for the "what should we watch?" scroll. Set a mood and
      how much time you have, roll the film strip, and it prints a ticket for something you can
      stream tonight.
    </p>
    <section>
      <h2>Movie data</h2>
      <a class="tmdb" href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
        <span class="mark" aria-hidden="true">TMDB</span>
        <span>The Movie Database</span>
      </a>
      <p class="note">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p class="note">
        Streaming availability is provided by
        <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">JustWatch</a
        >.
      </p>
    </section>
    <section>
      <h2>Privacy</h2>
      <p class="note">
        We keep your name and a few simple counts, like tickets pulled. Your filters and lists stay
        on this phone. Delete your name any time in Settings.
      </p>
    </section>
    <section>
      <h2>Contact us</h2>
      <p class="note">
        Found a bug, a wrong streaming link, or have an idea? Write to
        <a [href]="contact">{{ email }}</a
        >.
      </p>
      <a class="btn ghost contact" [href]="contact">Contact us</a>
    </section>
    <section>
      <h2>Made by</h2>
      <p class="note">
        Jarem Salonga, also behind
        <a href="https://whattoeat.jsalonga.dev" target="_blank" rel="noopener">What to Eat?</a>
      </p>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: 22px;
    }
    .h {
      margin: 4px 0 0;
      font: 900 2.2rem/1 var(--display);
      text-transform: uppercase;
    }
    p {
      margin: 0;
      max-width: 62ch;
    }
    section {
      display: grid;
      gap: 8px;
    }
    h2 {
      margin: 0;
      font: 600 0.72rem/1 var(--mono);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--dim);
    }
    .contact {
      justify-self: start;
      width: auto;
      padding-inline: 1.4rem;
      text-decoration: none;
    }
    .note a {
      color: var(--lamp);
    }
    .tmdb {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--fg);
      text-decoration: none;
      font-weight: 700;
    }
    .mark {
      font: 800 1rem/1 var(--body);
      letter-spacing: 0.04em;
      padding: 6px 10px;
      border-radius: 6px;
      color: oklch(0.2 0.05 240);
      background: linear-gradient(90deg, oklch(0.85 0.14 180), oklch(0.72 0.15 235));
    }
  `,
})
export class About {
  protected readonly email = CONTACT_EMAIL;
  protected readonly contact = contactUrl('What to Watch? feedback');
}
