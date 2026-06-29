import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface IdleWarningDialogData {
  /** Seconds remaining before auto-logout fires. */
  countdownSeconds: number;
}

@Component({
  selector: 'app-idle-warning-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './idle-warning-dialog.html',
})
export class IdleWarningDialog implements OnInit, OnDestroy {
  remaining: number;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    private readonly dialogRef: MatDialogRef<IdleWarningDialog>,
    @Inject(MAT_DIALOG_DATA) data: IdleWarningDialogData,
  ) {
    this.remaining = data.countdownSeconds;
  }

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.dismiss(false);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
    }
  }

  staySignedIn(): void {
    this.dismiss(true);
  }

  private dismiss(staySignedIn: boolean): void {
    clearInterval(this.intervalId);
    this.dialogRef.close(staySignedIn);
  }
}
