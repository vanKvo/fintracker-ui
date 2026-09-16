import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Category } from '../../../core/services/category.service';

export interface DeleteCategoryDialogData {
  category: Category;
  transactionCount: number;
  /** Every other category visible to the user (system + their own), for the reassignment
   * dropdown — never includes the category being deleted. */
  otherCategories: Category[];
}

export interface DeleteCategoryDialogResult {
  reassignToCategoryId: string | null;
}

/**
 * REQ-TS-01 #6: deleting a custom category. Adapts to whether it's actually in use — a plain
 * confirmation when transactionCount is 0, or a required reassignment target when it's not, so
 * the user is never asked to pick a target for a category nothing references.
 */
@Component({
  selector: 'app-delete-category-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule],
  templateUrl: './delete-category-dialog.html',
  styleUrl: './delete-category-dialog.scss'
})
export class DeleteCategoryDialog {
  reassignToCategoryId = signal<string | null>(null);

  constructor(
    private dialogRef: MatDialogRef<DeleteCategoryDialog, DeleteCategoryDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteCategoryDialogData
  ) {}

  get requiresReassignment(): boolean {
    return this.data.transactionCount > 0;
  }

  get canConfirm(): boolean {
    return !this.requiresReassignment || this.reassignToCategoryId() !== null;
  }

  cancel() {
    this.dialogRef.close(null);
  }

  confirm() {
    if (!this.canConfirm) {
      return;
    }
    this.dialogRef.close({ reassignToCategoryId: this.reassignToCategoryId() });
  }
}
