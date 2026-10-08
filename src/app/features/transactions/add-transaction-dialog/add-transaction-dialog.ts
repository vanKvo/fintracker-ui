import { Component, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { Account } from '../../../core/services/account.service';
import { TransactionDirection, TransactionType } from '../../../core/services/transaction.service';

export interface AddTransactionDialogData {
  accounts: Account[];
  categories: string[];
}

// REQ-2.3.1 "Manual Row Insertion" — mirrors the Ledger's ManualTransactionRequest shape.
// txDate is omitted entirely (not sent as null) when the user leaves the date field at its
// default, so the backend's "defaults to today" behavior is exercised for real rather than the
// UI pre-computing today's date itself — the two could drift by a day around midnight otherwise.
export interface CreateTransactionResult {
  accountId: string;
  amount: number;
  merchant: string;
  category: string;
  txDate?: string;
  type: TransactionType;
  direction: TransactionDirection;
}

// TXT-01: EXPENSE is always money out; INCOME and REFUND always money in (the Ledger rejects
// anything else). TRANSFER and ADJUSTMENT can go either way.
const DIRECTION_FOR_TYPE: Partial<Record<TransactionType, TransactionDirection>> = {
  EXPENSE: 'DEBIT',
  INCOME: 'CREDIT',
  REFUND: 'CREDIT',
};

@Component({
  selector: 'app-add-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatRadioModule
  ],
  templateUrl: './add-transaction-dialog.html',
  styleUrl: './add-transaction-dialog.scss'
})
export class AddTransactionDialog {
  accounts: Account[];
  categories: string[];

  // REQ-2.3.1.D: Date defaults to today; the user can pick another date.
  date = signal<Date | null>(new Date());
  accountId = signal<string | null>(null);
  category = signal<string | null>(null);
  merchant = signal('');
  amount = signal<number | null>(null);
  type = signal<TransactionType>('EXPENSE');
  direction = signal<TransactionDirection>('DEBIT');
  directionLocked = computed(() => DIRECTION_FOR_TYPE[this.type()] !== undefined);

  readonly typeOptions: { value: TransactionType; label: string }[] = [
    { value: 'EXPENSE', label: 'Expense' },
    { value: 'INCOME', label: 'Income' },
    { value: 'REFUND', label: 'Refund' },
    { value: 'TRANSFER', label: 'Transfer' },
    { value: 'ADJUSTMENT', label: 'Adjustment' },
  ];

  canSubmit = computed(() =>
    this.date() !== null
    && this.accountId() !== null
    && this.category() !== null
    && this.merchant().trim().length > 0
    && (this.amount() ?? 0) > 0
  );

  constructor(
    private dialogRef: MatDialogRef<AddTransactionDialog>,
    @Inject(MAT_DIALOG_DATA) data: AddTransactionDialogData
  ) {
    this.accounts = data.accounts;
    this.categories = data.categories;
  }

  selectType(type: TransactionType): void {
    this.type.set(type);
    const direction = DIRECTION_FOR_TYPE[type];
    if (direction) this.direction.set(direction);
  }

  updateAmount(rawValue: string): void {
    this.amount.set(rawValue === '' ? null : Number(rawValue));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (!this.canSubmit()) return;

    // The user always enters a positive number; sign is derived from the direction so they
    // never have to think about "money out is negative" — same UX simplification the inline
    // amount editor doesn't have the luxury of, since it edits an already-signed value.
    const signedAmount = this.direction() === 'DEBIT'
      ? -Math.abs(this.amount() as number)
      : Math.abs(this.amount() as number);

    const today = new Date();
    const selectedDate = this.date() as Date;
    const isToday = selectedDate.toDateString() === today.toDateString();

    const result: CreateTransactionResult = {
      accountId: this.accountId() as string,
      amount: signedAmount,
      merchant: this.merchant().trim(),
      category: this.category() as string,
      type: this.type(),
      direction: this.direction(),
      ...(isToday ? {} : { txDate: this.toLocalDateString(selectedDate) })
    };
    this.dialogRef.close(result);
  }

  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
