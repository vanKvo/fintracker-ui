import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { fetchAuthSession } from 'aws-amplify/auth';
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
  private navigated = false;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    // Register the Hub listener BEFORE the session check.
    // Amplify v6 starts the OAuth code exchange during Amplify.configure() in
    // app.config.ts — before any Angular component mounts. If the exchange
    // completes before ngOnInit runs, the Hub event is already missed.
    // The session check below covers that case; the Hub listener covers the
    // case where exchange completes after this component mounts.
    this.hubUnsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        this.complete('/dashboard');
      }
      if (payload.event === 'signInWithRedirect_failure') {
        this.complete('/auth/login', { error: 'auth_failed' });
      }
    });

    // Check whether Amplify already exchanged the code before this component
    // mounted. If valid tokens exist, navigate immediately.
    this.checkExistingSession();

    // Safety fallback: if neither path resolves within 10 s, redirect to login.
    this.timeoutId = setTimeout(
      () => this.complete('/auth/login', { error: 'auth_timeout' }),
      10_000,
    );
  }

  ngOnDestroy(): void {
    this.hubUnsubscribe?.();
    this.clearTimers();
  }

  private async checkExistingSession(): Promise<void> {
    try {
      const session = await fetchAuthSession();
      if (session.tokens) {
        this.complete('/dashboard');
      }
    } catch {
      // No session yet — Hub listener will handle the event when the exchange completes.
    }
  }

  private complete(path: string, queryParams?: Record<string, string>): void {
    if (this.navigated) return;
    this.navigated = true;
    this.clearTimers();
    this.hubUnsubscribe?.();
    this.router.navigate([path], queryParams ? { queryParams } : {});
  }

  private clearTimers(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
