import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Hub } from 'aws-amplify/utils';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  templateUrl: './callback.html',
})
export class Callback implements OnInit, OnDestroy {
  private hubUnsubscribe?: () => void;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    // Amplify processes the authorization code in the URL automatically.
    // We listen for the signedIn event then navigate to the dashboard.
    this.hubUnsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        this.clearTimeout();
        this.router.navigate(['/dashboard']);
      }
      if (payload.event === 'signInWithRedirect_failure') {
        this.clearTimeout();
        this.router.navigate(['/auth/login'], {
          queryParams: { error: 'auth_failed' },
        });
      }
    });

    // Safety fallback: if Amplify hasn't resolved within 10 seconds, redirect.
    this.timeoutId = setTimeout(() => {
      this.router.navigate(['/auth/login'], {
        queryParams: { error: 'auth_timeout' },
      });
    }, 10_000);
  }

  ngOnDestroy(): void {
    this.hubUnsubscribe?.();
    this.clearTimeout();
  }

  private clearTimeout(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
