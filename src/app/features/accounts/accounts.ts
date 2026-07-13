import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { AccountService, Account, UpdateAccountRequest } from '../../core/services/account.service';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { AddAccountDialog } from './add-account-dialog/add-account-dialog';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatSnackBarModule
  ],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss'
})
export class Accounts implements OnInit {
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private accountService = inject(AccountService);

  accounts = signal<Account[]>([]);
  displayedColumns = [
    'accountName', 
    'accountNumberLast4', 
    'accountType', 
    'owner', 
    'syncMode', 
    'currentBalance', 
    'createdAt', 
    'status',
    'actions'
  ];

  // Inline edit state
  editingAccountId = signal<string | null>(null);
  
  // Temporary form variables for active inline row
  editAccountName = '';
  editAccountType = '';
  editAccountNumber = '';
  editOwner = '';
  editSyncMode: 'MANUAL' | 'AUTOMATED' = 'MANUAL';

  ngOnInit() {
    this.fetchAccounts();
  }

  fetchAccounts() {
    this.accountService.getAccounts().subscribe({
      next: (data) => {
        // Fallback for fields in case of new/incomplete database schema
        const mapped = data.map(acc => ({
          ...acc,
          accountNumberLast4: acc.accountNumberLast4 || '••••',
          owner: acc.owner || 'John Doe',
          syncMode: acc.syncMode || 'MANUAL',
          createdAt: acc.createdAt || new Date().toISOString()
        }));
        this.accounts.set(mapped);
      },
      error: () => this.snackBar.open('Failed to load accounts.', 'Dismiss', { duration: 5000 })
    });
  }

  openLinkAccountDialog() {
    const dialogRef = this.dialog.open(AddAccountDialog, {
      width: '450px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.fetchAccounts();
      }
    });
  }

  startEdit(row: Account) {
    this.editingAccountId.set(row.accountId);
    this.editAccountName = row.accountName;
    this.editAccountType = row.accountType;
    this.editAccountNumber = row.accountNumberLast4 || '';
    this.editOwner = row.owner || '';
    this.editSyncMode = (row.syncMode as 'MANUAL' | 'AUTOMATED') || 'MANUAL';
  }

  cancelEdit() {
    this.editingAccountId.set(null);
  }

  saveEdit(row: Account) {
    // Validate characters as per REQ-3.1.D
    const alphaNumSpaceHyphenSlash = /^[a-zA-Z0-9\s-/]+$/;
    const alphaNumOnly = /^[a-zA-Z0-9]+$/;

    const nameVal = this.editAccountName.trim();
    const typeVal = this.editAccountType.trim();
    const ownerVal = this.editOwner.trim();
    const numberVal = this.editAccountNumber.trim();

    if (!nameVal || !typeVal || !ownerVal) {
      this.snackBar.open('Account Name, Type, and Owner are required.', 'Dismiss', { duration: 3000 });
      return;
    }

    if (!alphaNumSpaceHyphenSlash.test(nameVal) || !alphaNumSpaceHyphenSlash.test(typeVal) || !alphaNumSpaceHyphenSlash.test(ownerVal)) {
      this.snackBar.open('Name, Type, and Owner can only contain letters, numbers, spaces, hyphens, and slashes.', 'Dismiss', { duration: 5000 });
      return;
    }

    if (numberVal && !alphaNumOnly.test(numberVal)) {
      this.snackBar.open('Account number can only contain letters and numbers.', 'Dismiss', { duration: 5000 });
      return;
    }

    // REQ-3.3 Sync Modes Warning Dialog transition warning
    if (row.syncMode === 'AUTOMATED' && this.editSyncMode === 'MANUAL') {
      const confirmChange = window.confirm(
        'Warning: Changing sync mode from AUTOMATED to MANUAL will stop automatic bank syncing for this account, and enable manual Statement Upload. Are you sure you want to proceed?'
      );
      if (!confirmChange) {
        return;
      }
    }

    const payload: UpdateAccountRequest = {
      accountName: nameVal,
      accountType: typeVal,
      owner: ownerVal,
      syncMode: this.editSyncMode
    };

    // Only send accountNumber if it was edited/changed
    if (numberVal && numberVal !== row.accountNumberLast4) {
      payload.accountNumber = numberVal;
    }

    this.accountService.updateAccount(row.accountId, payload).subscribe({
      next: () => {
        this.snackBar.open('Account updated successfully!', 'Dismiss', { duration: 3000 });
        this.editingAccountId.set(null);
        this.fetchAccounts();
      },
      error: () => this.snackBar.open('Failed to update account. Make sure input formats are correct.', 'Dismiss', { duration: 5000 })
    });
  }
}
