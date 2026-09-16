import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDeleteDialogData {
  monthLabel: string;
  lineCount: number;
}

/**
 * REQ-5.1 A.3 "Delete Budget" — the confirmation gate in front of an irreversible write.
 *
 * <p>Deleting a budget removes its line items with it and cannot be undone, so the dialog states
 * what is about to be lost in concrete terms (which month, how many categories) rather than
 * asking a generic "Are you sure?". The destructive action is never the default: the dialog
 * returns false on backdrop click and on Escape, and only an explicit click on Delete returns
 * true.
 */
@Component({
  selector: 'app-confirm-delete-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-delete-dialog.html',
  styleUrl: './confirm-delete-dialog.scss'
})
export class ConfirmDeleteDialog {
  constructor(
    private dialogRef: MatDialogRef<ConfirmDeleteDialog, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDeleteDialogData
  ) {}

  cancel() {
    this.dialogRef.close(false);
  }

  confirm() {
    this.dialogRef.close(true);
  }
}
