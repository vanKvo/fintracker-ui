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
  accountType = signal('Checking');
  accountNumber = signal('');
  owner = signal('John Doe');
  syncMode = signal<'MANUAL' | 'AUTOMATED'>('MANUAL');

  accountTypes = ['Checking', 'Savings', 'Credit Card', 'Investment'];

  cancel() {
    this.dialogRef.close(false);
  }

  link() {
    const nameVal = this.accountName().trim();
    const typeVal = this.accountType().trim();
    const ownerVal = this.owner().trim();
    const numberVal = this.accountNumber().trim();

    if (!nameVal || !typeVal) {
      this.snackBar.open('Account Name and Account Type are required.', 'Dismiss', { duration: 3000 });
      return;
    }

    // Alphanumeric constraints: Alphanumeric letters, spaces, hyphens, and dashes/slashes only for Name/Type/Owner.
    const alphaNumSpaceHyphenSlash = /^[a-zA-Z0-9\s-/]+$/;
    // Alphanumeric only for Account number
    const alphaNumOnly = /^[a-zA-Z0-9]+$/;

    if (!alphaNumSpaceHyphenSlash.test(nameVal)) {
      this.snackBar.open('Account Name contains invalid characters.', 'Dismiss', { duration: 4000 });
      return;
    }

    if (!alphaNumSpaceHyphenSlash.test(typeVal)) {
      this.snackBar.open('Account Type contains invalid characters.', 'Dismiss', { duration: 4000 });
      return;
    }

    if (ownerVal && !alphaNumSpaceHyphenSlash.test(ownerVal)) {
      this.snackBar.open('Owner Name contains invalid characters.', 'Dismiss', { duration: 4000 });
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
