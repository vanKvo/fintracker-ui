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
  periodDate: Date;
  period: string;
  transactions: number;
  pending: number;
  approved: number;
  status: 'Processing' | 'Needs Attention' | 'Completed' | 'Failed';
  description?: string;
  // The Ledger's statement record doesn't carry these yet (no per-statement purchase/credit
  // totals, upload timestamps, or original filename) — always undefined until that lands.
  // The template already renders a safe fallback ('$0.00' / hidden row) for each.
  lastUploadInfo?: string;
  updatedAt?: string;
  fileName?: string;
  totalPurchases?: string;
  totalCredits?: string;
  totalBalance?: string;
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

  statementsList = signal<Statement[]>([]);
  loading = signal(true);
  loadFailed = signal(false);

  selectedStatementId = signal<string | null>(null);

  readonly currentYear = new Date().getFullYear();
  private expandedYears: Record<number, boolean> = {};

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

  recentStatements = computed(() =>
    this.filteredStatements().filter(s => this.isRecent(s.periodDate))
  );

  priorStatements = computed(() =>
    this.filteredStatements().filter(s =>
      s.periodDate.getFullYear() === this.currentYear && !this.isRecent(s.periodDate)
    )
  );

  /**
   * Distinct past years present in the data, newest first — replaces the page's original
   * hardcoded "2025"/"2024" sections, which silently dropped any statement outside those two
   * literal years instead of ever surfacing it.
   */
  priorYears = computed(() => {
    const years = new Set(
      this.filteredStatements()
        .map(s => s.periodDate.getFullYear())
        .filter(year => year < this.currentYear)
    );
    return [...years].sort((a, b) => b - a);
  });

  selectedStatement = computed(() => {
    return this.statementsList().find(s => s.id === this.selectedStatementId());
  });

  ngOnInit() {
    this.loadStatements();
  }

  loadStatements() {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.statementService.getStatements().subscribe({
      next: raw => {
        const statements = raw.map(r => this.toViewModel(r));
        this.statementsList.set(statements);
        this.extractUniqueAccounts();
        if (this.selectedStatementId() === null && statements.length > 0) {
          this.selectedStatementId.set(statements[0].id);
        }
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.loadFailed.set(true);
        const message = err?.error?.detail || 'Failed to load statements.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  private toViewModel(raw: any): Statement {
    const periodDate = this.parseLocalDate(raw.period);
    const pending = raw.pending ?? 0;
    // A completed import that still has unreviewed transactions needs the user's attention,
    // same as the page's original mock data modeled — just derived from real counts now
    // instead of a hardcoded status string the backend never actually sends.
    const status: Statement['status'] =
      raw.status === 'Completed' && pending > 0 ? 'Needs Attention' : raw.status;

    return {
      id: raw.id,
      account: raw.account,
      periodDate,
      period: periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      transactions: raw.transactions ?? 0,
      pending,
      approved: raw.approved ?? 0,
      status,
      description: raw.description || undefined
    };
  }

  /**
   * Parses the Ledger's date-only statementMonth ("YYYY-MM-DD") in the LOCAL timezone.
   * `new Date('2026-08-01')` parses a date-only string as UTC midnight, which in any
   * negative-offset timezone resolves to the previous day locally — see
   * docs/bugs/bug_dashboard_date_only_parsed_as_utc_shifts_month.md for the same class of bug
   * already found and fixed on the Dashboard.
   */
  private parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private isRecent(date: Date): boolean {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  extractUniqueAccounts() {
    const uniqueAccounts = [...new Set(this.statementsList().map(s => s.account))];
    this.accounts = ['All Accounts', ...uniqueAccounts];
  }

  getStatementsForYear(year: number): Statement[] {
    return this.filteredStatements().filter(s => s.periodDate.getFullYear() === year);
  }

  /** The most recent prior year opens expanded by default; older years start collapsed. */
  isYearExpanded(year: number): boolean {
    const defaultExpanded = this.priorYears()[0] === year;
    return this.expandedYears[year] ?? defaultExpanded;
  }

  toggleYear(year: number) {
    this.expandedYears = { ...this.expandedYears, [year]: !this.isYearExpanded(year) };
  }

  selectStatement(id: string) {
    this.selectedStatementId.set(id);
  }

  openUploadModal() {
    const dialogRef = this.dialog.open(UploadStatementModal, {
      width: '480px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const message = result.finalStatus === 'PARTIALLY_COMPLETED'
          ? 'Statement imported — some transactions need review.'
          : 'Statement imported successfully.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        this.loadStatements();
      }
    });
  }

  // NOTE: optimistic local update only — there is no bulk "approve all transactions for a
  // statement" endpoint yet (TransactionService only exposes approveTransaction(id) one at a
  // time, with no way to look up which transaction ids belong to a given statement). Wiring
  // this to the backend needs that endpoint first; until then this does not persist.
  approveAllPending(statement: Statement) {
    if (statement.pending > 0) {
      this.statementsList.update(list => list.map(s => {
        if (s.id === statement.id) {
          return { ...s, pending: 0, approved: s.approved + s.pending, status: 'Completed' };
        }
        return s;
      }));
    }
  }

  deleteStatement(statement: Statement) {
    this.statementService.deleteStatement(statement.id).subscribe({
      next: () => {
        this.statementsList.update(list => list.filter(s => s.id !== statement.id));
        if (this.selectedStatementId() === statement.id) {
          const remaining = this.filteredStatements();
          this.selectedStatementId.set(remaining.length > 0 ? remaining[0].id : null);
        }
        this.snackBar.open('Statement deleted.', 'Dismiss', { duration: 4000 });
      },
      error: err => {
        const message = err?.error?.detail || 'Failed to delete this statement.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }
}
