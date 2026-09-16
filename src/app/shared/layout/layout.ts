import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { IdleTimerService } from '../../core/services/idle-timer.service';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-layout',
  imports: [
    CommonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
    MatMenuModule,
    RouterOutlet,
    RouterModule,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout implements OnInit, OnDestroy {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly authService = inject(AuthService);
  private readonly idleTimer = inject(IdleTimerService);
  private readonly profileService = inject(ProfileService);

  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(map((result) => result.matches), shareReplay());

  /** Falls back to this if the profile service is slow/unreachable — never blocks the page. */
  displayName = 'Account';

  ngOnInit(): void {
    this.idleTimer.start();
    this.profileService.getProfile().pipe(
      catchError(() => of(null))
    ).subscribe(profile => {
      if (profile) {
        this.displayName = `${profile.firstName} ${profile.lastName}`.trim() || 'Account';
      }
    });
  }

  ngOnDestroy(): void {
    this.idleTimer.stop();
  }

  logout(): void {
    this.authService.signOut();
  }
}
