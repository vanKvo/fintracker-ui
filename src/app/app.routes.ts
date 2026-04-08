import { Routes } from '@angular/router';
import { Layout } from './shared/layout/layout';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'transactions',
        loadComponent: () => import('./features/transactions/transactions').then(m => m.Transactions)
      },
      {
        path: 'statements',
        loadComponent: () => import('./features/statements/statements').then(m => m.Statements)
      },
      {
        path: 'budgets',
        loadComponent: () => import('./features/budgets/budgets').then(m => m.Budgets)
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports').then(m => m.Reports)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.Settings)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
