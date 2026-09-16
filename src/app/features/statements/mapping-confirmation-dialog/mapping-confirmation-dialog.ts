import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ColumnMappingProposal } from '../../../core/services/statement.service';

export interface MappingConfirmationDialogData {
  proposal: ColumnMappingProposal;
}

const CANONICAL_FIELDS = ['date', 'merchant', 'amount'] as const;
type CanonicalField = (typeof CANONICAL_FIELDS)[number];

const FIELD_LABELS: Record<CanonicalField, string> = {
  date: 'Transaction Date',
  merchant: 'Merchant / Description',
  amount: 'Amount',
};

/**
 * REQ-DP-01 "Mapping Transparency" + "User Mapping Confirmation Gate": shows
 * every column the CSV actually has — the ones the backend auto-matched,
 * pre-selected, and the ones it couldn't, left for the user to pick — and
 * blocks the import until the user confirms (or corrects) all three
 * required fields. Nothing is parsed server-side until this dialog closes
 * with a confirmed mapping.
 */
@Component({
  selector: 'app-mapping-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatIconModule, FormsModule],
  templateUrl: './mapping-confirmation-dialog.html',
  styleUrl: './mapping-confirmation-dialog.scss',
})
export class MappingConfirmationDialog {
  private dialogRef = inject(MatDialogRef<MappingConfirmationDialog, Record<string, string> | undefined>);
  data = inject<MappingConfirmationDialogData>(MAT_DIALOG_DATA);

  readonly fields = CANONICAL_FIELDS;
  readonly fieldLabels = FIELD_LABELS;

  /** Every column the file actually has — auto-matched or not — so the
   * user can reassign a column the system guessed wrong, not just fill in
   * the gaps (REQ-DP-01 B. Constraints). */
  readonly allColumns = computed(() => {
    const mapped = Object.values(this.data.proposal.mapped);
    return [...mapped, ...this.data.proposal.unmappedColumns];
  });

  selections = signal<Record<CanonicalField, string>>({
    date: this.data.proposal.mapped['date'] ?? '',
    merchant: this.data.proposal.mapped['merchant'] ?? '',
    amount: this.data.proposal.mapped['amount'] ?? '',
  });

  readonly canConfirm = computed(() => this.fields.every((f) => !!this.selections()[f]));

  setSelection(field: CanonicalField, column: string): void {
    this.selections.update((current) => ({ ...current, [field]: column }));
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.dialogRef.close({ ...this.selections() });
  }
}
