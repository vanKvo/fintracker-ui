import { Component, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';

export interface SplitTransactionDialogData {
  merchant: string;
  totalAmount: number;
  categories: string[];
}

export interface SplitResult {
  amount: number;
  category: string;
}

interface SplitRow {
  amount: number | null;
  category: string;
}

@Component({
  selector: 'app-split-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './split-transaction-dialog.html',
  styleUrl: './split-transaction-dialog.scss'
})
export class SplitTransactionDialog {
  merchant: string;
  totalAmount: number;
  absTotal: number;
  categories: string[];

  rows = signal<SplitRow[]>([
    { amount: null, category: '' },
    { amount: null, category: '' }
  ]);

  allocated = computed(() =>
    this.rows().reduce((sum, row) => sum + (row.amount ?? 0), 0)
  );

  // Rounded to cents to avoid floating-point noise (e.g. 0.1 + 0.2 !== 0.3) blocking a valid split.
  remaining = computed(() =>
    Math.round((this.absTotal - this.allocated()) * 100) / 100
  );

  canSubmit = computed(() => {
    const rows = this.rows();
    return rows.length >= 2
      && rows.every(r => r.category.trim().length > 0 && (r.amount ?? 0) > 0)
      && this.remaining() === 0;
  });

  constructor(
    private dialogRef: MatDialogRef<SplitTransactionDialog>,
    @Inject(MAT_DIALOG_DATA) data: SplitTransactionDialogData
  ) {
    this.merchant = data.merchant;
    this.totalAmount = data.totalAmount;
    this.absTotal = Math.abs(data.totalAmount);
    this.categories = data.categories;
  }

  addRow(): void {
    this.rows.update(rows => [...rows, { amount: null, category: '' }]);
  }

  removeRow(index: number): void {
    if (this.rows().length <= 2) return;
    this.rows.update(rows => rows.filter((_, i) => i !== index));
  }

  updateAmount(index: number, rawValue: string): void {
    const amount = rawValue === '' ? null : Number(rawValue);
    this.rows.update(rows => rows.map((r, i) => i === index ? { ...r, amount } : r));
  }

  updateCategory(index: number, category: string): void {
    this.rows.update(rows => rows.map((r, i) => i === index ? { ...r, category } : r));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (!this.canSubmit()) return;

    const sign = this.totalAmount < 0 ? -1 : 1;
    const result: SplitResult[] = this.rows().map(r => ({
      amount: Math.abs(r.amount as number) * sign,
      category: r.category
    }));
    this.dialogRef.close(result);
  }
}
