import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DuplicateInfo, DuplicateMatchType } from '../../../core/services/statement.service';

export interface DuplicateStatementDialogData {
  duplicate: DuplicateInfo;
  /**
   * True when the duplicate was found after processing had already started (REQ-STMT-04). The
   * choices are identical either way — only the explanation of what happens next differs, because
   * an overwrite at this point restarts the upload rather than continuing it.
   */
  midProcessing?: boolean;
}

export type DuplicateResolution = 'overwrite' | 'cancel';

/**
 * REQ-STMT-05: the one "statement already exists" prompt, shown for every path that can detect a
 * duplicate — the exact-file and same-month checks at upload time (REQ-STMT-03/06), the
 * content-fingerprint check mid-processing (REQ-STMT-04), and the server-side recheck
 * (REQ-STMT-08). Same information, same two choices, so the user learns one interaction.
 */
@Component({
  selector: 'app-duplicate-statement-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './duplicate-statement-dialog.html',
  styleUrl: './duplicate-statement-dialog.scss',
})
export class DuplicateStatementDialog {
  private dialogRef = inject(MatDialogRef<DuplicateStatementDialog, DuplicateResolution | undefined>);
  data = inject<DuplicateStatementDialogData>(MAT_DIALOG_DATA);

  /**
   * Why the system thinks this is a duplicate, in the user's terms. The wording differs per match
   * type on purpose: "the same file" and "a statement for this month" are different situations,
   * and telling the user which one applies is what lets them judge whether overwriting is right.
   */
  readonly reason = computed(() => {
    const messages: Record<DuplicateMatchType, string> = {
      EXACT_FILE: 'You have already uploaded this exact file to this account.',
      CONTENT_FINGERPRINT:
        'This file contains the same transactions as a statement already on this account. '
        + 'It may be a corrected re-export, or the same period in a different format.',
      SAME_MONTH: 'This account already has a statement covering this month.',
    };
    return messages[this.data.duplicate.matchType];
  });

  /** A fingerprint match is a likelihood, not a certainty — the wording must not overstate it. */
  readonly isProbableMatch = computed(() => this.data.duplicate.matchType === 'CONTENT_FINGERPRINT');

  readonly overwriteConsequence = computed(() =>
    this.data.midProcessing
      ? 'The existing statement and its transactions will be removed, and this file will be '
        + 'uploaded again from the start.'
      : 'The existing statement and its transactions will be removed and replaced by this file.'
  );

  overwrite(): void {
    this.dialogRef.close('overwrite');
  }

  cancel(): void {
    this.dialogRef.close('cancel');
  }
}
