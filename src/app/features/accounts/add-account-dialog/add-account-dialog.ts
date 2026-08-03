import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { AccountService, CreateAccountRequest } from '../../../core/services/account.service';

@Component({
  selector: 'app-add-account-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
    MatSnackBarModule
  ],
  templateUrl: './add-account-dialog.html',
  styleUrl: './add-account-dialog.scss'
})
export class AddAccountDialog {
  private dialogRef = inject(MatDialogRef<AddAccountDialog>);
  private snackBar = inject(MatSnackBar);
  private accountService = inject(AccountService);

  accountName = signal('');
  accountType = signal('CHECKING');
  accountNumber = signal('');
  owner = signal('John Doe');
  syncMode = signal<'MANUAL' | 'AUTOMATED'>('MANUAL');

  // Must match ledger.accounts' account_type CHECK constraint (V1__Initial_Schema.sql,
  // widened by V7__Add_Cash_Account_Type.sql) exactly — any value outside this set is rejected
  // by the database, not just the application layer.
  accountTypes = [
    { value: 'CHECKING', label: 'Checking' },
    { value: 'SAVINGS', label: 'Savings' },
    { value: 'CREDIT', label: 'Credit' },
    { value: 'CASH', label: 'Cash' }
  ];

  cancel() {
    this.dialogRef.close(false);
  }

  link() {
    const nameVal = this.accountName().trim();
    const typeVal = this.accountType().trim();
    const ownerVal = this.owner().trim();
    const numberVal = this.accountNumber().trim();

    // Cash isn't a real bank account, so there's no account number to record for it.
    const numberRequired = typeVal !== 'CASH';

    if (!nameVal || !typeVal || !ownerVal || (numberRequired && !numberVal)) {
      const fields = numberRequired
        ? 'Account Name, Account Type, Account Number and Owner are required.'
        : 'Account Name, Account Type, and Owner are required.';
      this.snackBar.open(fields, 'Dismiss', { duration: 3000 });
      return;
    }

    // REQ-3.1.D: Alphanumeric letters, spaces, and hyphens only for Name/Type/Owner — must match
    // AccountServiceImpl's NAME_FIELD_PATTERN/ACCOUNT_NUMBER_PATTERN exactly, so nothing accepted
    // here ever gets rejected by the backend after the fact.
    const alphaNumSpaceHyphen = /^[a-zA-Z0-9 -]+$/;
    // Alphanumeric only for Account number
    const alphaNumOnly = /^[a-zA-Z0-9]+$/;

    if (!alphaNumSpaceHyphen.test(nameVal)) {
      this.snackBar.open('Account Name can only contain letters, numbers, spaces, and hyphens.', 'Dismiss', { duration: 4000 });
      return;
    }

    if (!alphaNumSpaceHyphen.test(typeVal)) {
      this.snackBar.open('Account Type can only contain letters, numbers, spaces, and hyphens.', 'Dismiss', { duration: 4000 });
      return;
    }

    if (ownerVal && !alphaNumSpaceHyphen.test(ownerVal)) {
      this.snackBar.open('Owner can only contain letters, numbers, spaces, and hyphens.', 'Dismiss', { duration: 4000 });
      return;
    }

    if (numberVal && !alphaNumOnly.test(numberVal)) {
      this.snackBar.open('Account Number can only contain letters and numbers.', 'Dismiss', { duration: 4000 });
      return;
    }

    const payload: CreateAccountRequest = {
      accountName: nameVal,
      accountType: typeVal,
      accountNumber: numberVal || undefined,
      owner: ownerVal || undefined,
      syncMode: this.syncMode()
    };

    this.accountService.createAccount(payload).subscribe({
      next: (created) => {
        this.snackBar.open('Account linked successfully!', 'Dismiss', { duration: 3000 });
        this.dialogRef.close(created);
      },
      error: () => this.snackBar.open('Failed to link account. Please verify details.', 'Dismiss', { duration: 5000 })
    });
  }
}
