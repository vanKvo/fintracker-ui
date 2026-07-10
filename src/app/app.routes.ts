import { Routes } from '@angular/router';
import { Layout } from './shared/layout/layout';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then(m => m.Landing),
    pathMatch: 'full'
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/callback/callback').then(m => m.Callback)
  },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
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
  { path: '**', redirectTo: '' }
];
