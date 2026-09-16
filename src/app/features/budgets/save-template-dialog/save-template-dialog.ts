import { Component, Inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface SaveTemplateDialogData {
  monthLabel: string;
  lineCount: number;
  /** Names the user already owns, so a doomed-to-409 name is caught before the request. */
  existingNames: string[];
}

export interface SaveTemplateResult {
  name: string;
  description: string | null;
}

/**
 * REQ-5.3 "Save as Template" — names the current budget's allocations for reuse.
 *
 * <p>Only the name and description are collected. The allocations themselves are read server-side
 * from the source budget, so the template can never be saved with figures the budget does not
 * actually contain.
 */
@Component({
  selector: 'app-save-template-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './save-template-dialog.html',
  styleUrl: './save-template-dialog.scss'
})
export class SaveTemplateDialog {
  name = signal('');
  description = signal('');

  private takenNames: Set<string>;

  // REQ-5.3 B "Template Name Uniqueness" is case-insensitive and per user. Mirrored here so the
  // conflict surfaces as inline guidance rather than a 409 after the fact; the server's partial
  // unique index remains the authority.
  nameTaken = computed(() => this.takenNames.has(this.name().trim().toLowerCase()));

  canSubmit = computed(() => {
    const value = this.name().trim();
    return value.length > 0 && value.length <= 100 && !this.nameTaken();
  });

  constructor(
    private dialogRef: MatDialogRef<SaveTemplateDialog, SaveTemplateResult>,
    @Inject(MAT_DIALOG_DATA) public data: SaveTemplateDialogData
  ) {
    this.takenNames = new Set((data.existingNames ?? []).map(n => n.trim().toLowerCase()));
    this.name.set(`${data.monthLabel} plan`);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (!this.canSubmit()) return;
    const description = this.description().trim();
    this.dialogRef.close({
      name: this.name().trim(),
      description: description.length > 0 ? description : null
    });
  }
}
