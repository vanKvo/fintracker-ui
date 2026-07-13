import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { StatementService } from '../../core/services/statement.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { UploadStatementModal } from './upload-statement-modal/upload-statement-modal';

interface Statement {
  id: string;
  account: string;
  period: string;
  transactions: number;
  pending: number;
  approved: number;
  status: 'Processing' | 'Needs Attention' | 'Completed' | 'Failed';
  description?: string;
  lastUploadInfo?: string;
  updatedAt?: string;
  fileName?: string;
  totalPurchases?: string;
  totalCredits?: string;
  totalBalance?: string;
  group?: 'recent' | 'prior' | 'prior-2025' | 'prior-2024';
}

@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [
    CommonModule,
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
  searchText = signal('');

  statementsList = signal<Statement[]>([
    {
      id: '1',
      account: 'Chase Checking',
      period: 'Oct 1 – Oct 31, 2025',
      transactions: 142,
      pending: 0,
      approved: 142,
      status: 'Completed',
      lastUploadInfo: 'Nov 2, 2025, 8:38 AM',
      updatedAt: 'Nov 2, 2025, 10:30 AM',
      fileName: 'chase_stmt_oct_25.pdf',
      totalPurchases: '-$14,250.70',
      totalCredits: '+$1,120.30',
      totalBalance: '$6,880.40',
      group: 'recent'
    },
    {
      id: '2',
      account: 'Capital One',
      period: 'Sept 1 – Sept 30, 2025',
      transactions: 110,
      pending: 12,
      approved: 98,
      status: 'Needs Attention',
      lastUploadInfo: 'Oct 2, 2025, 9:00 AM',
      updatedAt: 'Oct 2, 2025, 9:15 AM',
      fileName: 'capital_one_stmt_sept_25.pdf',
      totalPurchases: '-$8,450.20',
      totalCredits: '+$3,210.00',
      totalBalance: '$5,240.20',
      group: 'prior'
    },
    {
      id: '3',
      account: 'Amex Platinum',
      period: 'Aug 1 – Aug 31, 2025',
      transactions: 88,
      pending: 0,
      approved: 88,
      status: 'Completed',
      lastUploadInfo: 'Sep 3, 2025, 10:15 AM',
      updatedAt: 'Sep 3, 2025, 11:45 AM',
      fileName: 'amex_platinum_stmt_aug_25.pdf',
      totalPurchases: '-$12,180.50',
      totalCredits: '+$5,000.00',
      totalBalance: '$10,819.50',
      group: 'prior'
    },
    {
      id: '4',
      account: 'Chase Checking',
      period: 'Jul 1 – Jul 31, 2024',
      transactions: 64,
      pending: 0,
      approved: 64,
      status: 'Completed',
      lastUploadInfo: 'Aug 2, 2024, 10:30 AM',
      updatedAt: 'Aug 2, 2024, 10:30 AM',
      fileName: 'chase_stmt_jul_24.pdf',
      totalPurchases: '-$5,200.00',
      totalCredits: '+$4,500.00',
      totalBalance: '$8,300.00',
      group: 'prior-2024'
    },
    {
      id: '5',
      account: 'Capital One',
      period: 'Jan 1 – Jan 31, 2025',
      transactions: 95,
      pending: 0,
      approved: 95,
      status: 'Completed',
      lastUploadInfo: 'Feb 2, 2025, 11:00 AM',
      updatedAt: 'Feb 2, 2025, 11:15 AM',
      fileName: 'capital_one_stmt_jan_25.pdf',
      totalPurchases: '-$6,120.00',
      totalCredits: '+$2,500.00',
      totalBalance: '$4,880.00',
      group: 'prior-2025'
    }
  ]);

  selectedStatementId = signal<string>('1');

  prior2025Expanded = signal(false);
  prior2024Expanded = signal(true);

  filteredStatements = computed(() => {
    const text = this.searchText().toLowerCase().trim();
    const acc = this.selectedAccount();
    return this.statementsList().filter(s => {
      const matchText = !text ||
        s.account.toLowerCase().includes(text) ||
        s.period.toLowerCase().includes(text);
      const matchAcc = acc === 'All Accounts' || s.account === acc;
      return matchText && matchAcc;
    });
  });

  selectedStatement = computed(() => {
    return this.statementsList().find(s => s.id === this.selectedStatementId());
  });

  ngOnInit() {
    this.extractUniqueAccounts();
  }

  extractUniqueAccounts() {
    const uniqueAccounts = [...new Set(this.statementsList().map(s => s.account))];
    this.accounts = ['All Accounts', ...uniqueAccounts];
  }

  selectStatement(id: string) {
    this.selectedStatementId.set(id);
  }

  getGroupedStatements(group: string) {
    return this.filteredStatements().filter(s => s.group === group);
  }

  togglePrior2025() {
    this.prior2025Expanded.update(v => !v);
  }

  togglePrior2024() {
    this.prior2024Expanded.update(v => !v);
  }

  openUploadModal() {
    const dialogRef = this.dialog.open(UploadStatementModal, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Upload result:', result);
      }
    });
  }

  approveAllPending(statement: Statement) {
    if (statement.pending > 0) {
      this.statementsList.update(list => list.map(s => {
        if (s.id === statement.id) {
          return { ...s, pending: 0, approved: s.approved + s.pending };
        }
        return s;
      }));
    }
  }

  deleteStatement(statement: Statement) {
    this.statementsList.update(list => list.filter(s => s.id !== statement.id));
    if (this.selectedStatementId() === statement.id) {
      const remaining = this.filteredStatements();
      if (remaining.length > 0) {
        this.selectedStatementId.set(remaining[0].id);
      }
    }
  }
}
