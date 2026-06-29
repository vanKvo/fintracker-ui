import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { StatementService } from '../../core/services/statement.service';
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
    MatFormFieldModule,
    MatSnackBarModule
  ],
  templateUrl: './statements.html',
  styleUrl: './statements.scss'
})
export class Statements implements OnInit {
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private statementService = inject(StatementService);

  accounts = ['All Accounts'];
  selectedAccount = signal('All Accounts');

  statements = signal<Statement[]>([]);

  displayedColumns: string[] = ['period', 'account', 'transactions', 'pending', 'approved', 'status', 'actions'];

  ngOnInit() {
    this.fetchStatements();
  }

  fetchStatements() {
    this.statementService.getStatements().subscribe({
      next: (data) => {
        this.statements.set(data);
        const uniqueAccounts = [...new Set(data.map(s => s.account))];
        this.accounts = ['All Accounts', ...uniqueAccounts];
      },
      error: () => this.snackBar.open('Failed to load statements.', 'Dismiss', { duration: 5000 })
    });
  }

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
