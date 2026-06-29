import { Injectable, NgZone } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from './auth.service';
import {
  IdleWarningDialog,
  IdleWarningDialogData,
} from '../../shared/idle-warning-dialog/idle-warning-dialog';

const IDLE_TIMEOUT_MS  = 15 * 60 * 1000;  // 15 minutes
const WARNING_AT_MS    = 13 * 60 * 1000;  // show dialog at 13 minutes
const WARNING_DURATION = 2 * 60;           // countdown seconds shown in dialog

const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'] as const;

@Injectable({ providedIn: 'root' })
export class IdleTimerService {
  private warningTimerId?: ReturnType<typeof setTimeout>;
  private logoutTimerId?: ReturnType<typeof setTimeout>;
  private dialogOpen = false;

  private readonly boundReset = () => this.reset();

  constructor(
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly zone: NgZone,
  ) {}

  start(): void {
    ACTIVITY_EVENTS.forEach((event) =>
      document.addEventListener(event, this.boundReset, { passive: true })
    );
    this.scheduleWarning();
  }

  stop(): void {
    ACTIVITY_EVENTS.forEach((event) =>
      document.removeEventListener(event, this.boundReset)
    );
    this.clearTimers();
    this.dialog.closeAll();
  }

  private reset(): void {
    if (this.dialogOpen) return;
    this.clearTimers();
    this.scheduleWarning();
  }

  private scheduleWarning(): void {
    this.warningTimerId = setTimeout(() => {
      this.zone.run(() => this.openWarningDialog());
    }, WARNING_AT_MS);

    this.logoutTimerId = setTimeout(() => {
      this.zone.run(() => this.authService.signOut());
    }, IDLE_TIMEOUT_MS);
  }

  private openWarningDialog(): void {
    if (this.dialogOpen) return;
    this.dialogOpen = true;

    const ref = this.dialog.open<IdleWarningDialog, IdleWarningDialogData, boolean>(
      IdleWarningDialog,
      {
        data: { countdownSeconds: WARNING_DURATION },
        disableClose: true,
        width: '380px',
      }
    );

    ref.afterClosed().subscribe((staySignedIn) => {
      this.dialogOpen = false;
      if (staySignedIn) {
        this.clearTimers();
        this.scheduleWarning();
      } else {
        this.authService.signOut();
      }
    });
  }

  private clearTimers(): void {
    clearTimeout(this.warningTimerId);
    clearTimeout(this.logoutTimerId);
  }
}
