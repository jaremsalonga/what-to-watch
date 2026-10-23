import { Routes } from '@angular/router';
import { Booth } from './booth/booth';

export const routes: Routes = [
  { path: '', component: Booth, title: 'What to Watch?' },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings').then((m) => m.Settings),
    title: 'Settings · What to Watch?',
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about').then((m) => m.About),
    title: 'About · What to Watch?',
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin').then((m) => m.Admin),
    title: 'Admin · What to Watch?',
  },
  { path: '**', redirectTo: '' },
];
