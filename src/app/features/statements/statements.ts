import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { UploadStatementModal } from './upload-statement-modal/upload-statement-modal';

interface Statement {
  id: string;
  period: string;
  account: string;
  transactions: number;
  pending: number;
  approved: number;
  status: 'Processing' | 'Needs Attention' | 'Completed' | 'Failed';
}

@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatMenuModule,
    MatDialogModule,
    MatFormFieldModule
  ],
  templateUrl: './statements.html',
  styleUrl: './statements.scss'
})
export class Statements {
  private dialog = inject(MatDialog);

  accounts = ['All Accounts', 'Chase Checking', 'Amex Platinum', 'Citi Double Cash'];
  selectedAccount = signal('All Accounts');

  statements = signal<Statement[]>([
    { id: '1', period: 'Mar 2026', account: 'Chase Checking', transactions: 134, pending: 3, approved: 131, status: 'Completed' },
    { id: '2', period: 'Feb 2026', account: 'Chase Checking', transactions: 128, pending: 0, approved: 128, status: 'Completed' },
    { id: '3', period: 'Jan 2026', account: 'Chase Checking', transactions: 121, pending: 0, approved: 121, status: 'Completed' },
  ]);

  displayedColumns: string[] = ['period', 'account', 'transactions', 'pending', 'approved', 'status', 'actions'];

  openUploadModal() {
    const dialogRef = this.dialog.open(UploadStatementModal, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Handle upload result
        console.log('Upload result:', result);
      }
    });
  }

  approveAllPending(statement: Statement) {
    if (statement.pending > 0) {
      this.statements.update(list => list.map(s => {
        if (s.id === statement.id) {
          return { ...s, pending: 0, approved: s.approved + s.pending };
        }
        return s;
      }));
    }
  }

  deleteStatement(statement: Statement) {
    this.statements.update(list => list.filter(s => s.id !== statement.id));
  }
}
