import { Component, ViewChild, AfterViewInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { TransactionDetailPanel } from './transaction-detail-panel/transaction-detail-panel';
import { SplitTransactionDialog, SplitResult } from './split-transaction-dialog/split-transaction-dialog';
// import { AddTagDialog } from './add-tag-dialog/add-tag-dialog'; // temporarily disabled — see openAddTagDialog() below
import { AddTransactionDialog, CreateTransactionResult } from './add-transaction-dialog/add-transaction-dialog';
import {
  TransactionDirection, TransactionService, TransactionType, UpdateTransactionPayload
} from '../../core/services/transaction.service';
import { AccountService, Account } from '../../core/services/account.service';
import { CategoryService } from '../../core/services/category.service';
import { catchError, map } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  account: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Manual';
  dbStatus: 'PENDING' | 'POSTED' | 'DELETED';
  source: 'STATEMENT_UPLOAD' | 'BANK_SYNC' | 'MANUAL_ENTRY';
  tags?: string[];
  notes?: string;
  description?: string;
  sourceStatementId?: string;
  isExcluded: boolean;
  isManual: boolean;
  type: TransactionType;
  direction: TransactionDirection;
  currency: string;
  isRecurring: boolean | null;
  linkedTransactionId: string | null;
}

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatMenuModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatDialogModule,
    TransactionDetailPanel
  ],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class Transactions implements AfterViewInit {
  // 'tags' column temporarily disabled — see openAddTagDialog() below
  displayedColumns: string[] = ['select', 'date', 'merchant', 'account', 'category', 'amount', 'status', 'source', 'actions'];
  dataSource = new MatTableDataSource<Transaction>([]);
  selection = new SelectionModel<Transaction>(true, []);

  categories: string[] = [];
  accounts: string[] = [];
  // Full account objects (with accountId) for the Add Transaction dialog's dropdown — distinct
  // from `accounts` above, which is just distinct account names for the filter toolbar.
  fullAccounts: Account[] = [];

  selectedCategory = 'All';
  selectedAccount = 'All';
  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedTab = signal(0); // 0: All, 1: Pending, 2: Approved, 3: Manual
  TotalAmount = signal(0);

  selectedTransaction = signal<Transaction | null>(null);

  // REQ-2.2 "Inline Row Modification" — one row editable at a time, same pattern as the
  // Accounts tab: an Edit action puts the whole row's editable fields (category, amount; the
  // only two fields PATCH /transactions/{id} accepts) into inputs, with Save/Cancel to commit.
  editingTransactionId = signal<string | null>(null);
  editCategory = '';
  editAmount = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private transactionService: TransactionService,
    private accountService: AccountService,
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.loadCategories();
    this.loadFullAccounts();
    this.loadTransactions();
  }

  // REQ-2.3.1 "Manual Row Insertion": accounts for the Add Transaction dialog's dropdown —
  // fetched directly rather than derived from transactions, so a user with accounts but zero
  // transactions yet can still add their first one.
  private loadFullAccounts() {
    this.accountService.getAccounts().subscribe({
      next: (accounts) => this.fullAccounts = accounts,
      error: () => this.snackBar.open('Failed to load accounts.', 'Dismiss', { duration: 5000 })
    });
  }

  // REQ-2.2 "Inline Row Modification" / REQ-TS-01: the category drop-down is the merged
  // system + this user's custom category list, not derived from whatever happens to be on
  // already-loaded transactions. Transactions still store category as a display-name string
  // (REQ-TS-01 deliberately did not migrate this to categoryId — see
  // ledger-transaction-tests-01.md's scope boundary), so only displayName is used here.
  private loadCategories() {
    this.categoryService.getCategories().pipe(
      map((categories) => categories.map((c) => c.displayName))
    ).subscribe({
      next: (categories) => this.categories = categories,
      error: () => this.snackBar.open('Failed to load categories.', 'Dismiss', { duration: 5000 })
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.setupFilter();
    this.calculateTotal();
  }

  private loadTransactions() {
    this.transactionService.getTransactions().pipe(
      catchError(error => {
        this.snackBar.open('Failed to load transactions. Verify ledger-service is running.', 'Dismiss', { duration: 5000 });
        return of([]);
      })
    ).subscribe(data => {
      this.dataSource.data = data;
      this.accounts = [...new Set(data.map(t => t.account))];
      this.selection.clear();
      this.applyFilter();
    });
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.dataSource.data);
  }

  setupFilter() {
    this.dataSource.filterPredicate = (data: Transaction, filter: string) => {
      const searchTerms = JSON.parse(filter);
      const matchMerchant = data.merchant.toLowerCase().includes(searchTerms.text);
      const matchCategory = searchTerms.category === 'All' || data.category === searchTerms.category;
      const matchAccount = searchTerms.account === 'All' || data.account === searchTerms.account;

      // data.date is a plain 'YYYY-MM-DD' string (from LocalDate); lexicographic
      // comparison is safe and avoids timezone-shift bugs from Date parsing.
      const matchStartDate = !searchTerms.startDate || data.date >= searchTerms.startDate;
      const matchEndDate = !searchTerms.endDate || data.date <= searchTerms.endDate;

      let matchStatus = true;
      if (searchTerms.tab === 1) matchStatus = data.status === 'Pending';
      if (searchTerms.tab === 2) matchStatus = data.status === 'Approved';
      if (searchTerms.tab === 3) matchStatus = data.status === 'Manual';

      return matchMerchant && matchCategory && matchAccount && matchStartDate && matchEndDate && matchStatus;
    };
  }

  onStartDateChange(date: Date | null) {
    this.startDate = date;
    this.applyFilter();
  }

  onEndDateChange(date: Date | null) {
    this.endDate = date;
    this.applyFilter();
  }

  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  applyFilter() {
    const searchInput = document.querySelector('input[placeholder="Search by merchant..."]') as HTMLInputElement;
    const searchText = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const filterValue = JSON.stringify({
      text: searchText,
      category: this.selectedCategory,
      account: this.selectedAccount,
      startDate: this.startDate ? this.toLocalDateString(this.startDate) : null,
      endDate: this.endDate ? this.toLocalDateString(this.endDate) : null,
      tab: this.selectedTab()
    });

    this.dataSource.filter = filterValue;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }

    this.calculateTotal();
  }

  onTabChange(tabIndex: number) {
    this.selectedTab.set(tabIndex);
    this.applyFilter();
  }

  calculateTotal() {
    const total = this.dataSource.filteredData.reduce((acc, curr) => acc + curr.amount, 0);
    this.TotalAmount.set(total);
  }

  openRow(row: Transaction) {
    this.selectedTransaction.set(row);
  }

  closePanel() {
    this.selectedTransaction.set(null);
  }

  // ── REQ-2.2.1 Inline Row Modification ──────────────────────────────────────

  isEditing(row: Transaction): boolean {
    return this.editingTransactionId() === row.id;
  }

  startEdit(row: Transaction) {
    this.editingTransactionId.set(row.id);
    this.editCategory = row.category;
    this.editAmount = String(row.amount);
  }

  cancelEdit() {
    this.editingTransactionId.set(null);
  }

  saveEdit(row: Transaction) {
    const amountValue = Number(this.editAmount);
    if (!Number.isFinite(amountValue) || amountValue === 0) {
      this.snackBar.open('Amount must be a non-zero number.', 'Dismiss', { duration: 4000 });
      return;
    }

    const payload: UpdateTransactionPayload = {};
    if (this.editCategory && this.editCategory !== row.category) {
      payload.category = this.editCategory;
    }
    if (amountValue !== row.amount) {
      payload.amount = amountValue;
    }

    this.editingTransactionId.set(null);
    if (Object.keys(payload).length === 0) return;

    this.transactionService.updateTransaction(row.id, payload).subscribe({
      next: () => this.loadTransactions(),
      error: () => this.snackBar.open('Failed to update transaction.', 'Dismiss', { duration: 5000 })
    });
  }

  // ── REQ-2.2.2 Tag Array Appending — temporarily disabled ────────────────────
  // Tags column and its "Add tag" menu action are commented out in transactions.html.
  // Re-enable by uncommenting both there and restoring this method + the AddTagDialog import.
  //
  // openAddTagDialog(row: Transaction) {
  //   const dialogRef = this.dialog.open(AddTagDialog, {
  //     width: '420px',
  //     data: { merchant: row.merchant, existingTags: row.tags ?? [] }
  //   });
  //
  //   dialogRef.afterClosed().subscribe((newTags: string[] | undefined) => {
  //     if (!newTags || newTags.length === 0) return;
  //
  //     this.transactionService.appendTags(row.id, newTags).subscribe({
  //       next: () => this.loadTransactions(),
  //       error: () => this.snackBar.open('Failed to add tags.', 'Dismiss', { duration: 5000 })
  //     });
  //   });
  // }

  // ── REQ-2.3.1 Manual Row Insertion ──────────────────────────────────────────

  openAddTransactionDialog() {
    // Refetch rather than reuse the constructor-loaded snapshots: if the initial page-load
    // fetch failed (e.g. backend was briefly down), `fullAccounts`/`categories` would otherwise
    // stay empty for the rest of the session with no retry, silently breaking this dialog.
    forkJoin([
      this.accountService.getAccounts(),
      this.categoryService.getCategories()
    ]).subscribe({
      next: ([accounts, categories]) => {
        this.fullAccounts = accounts;
        this.categories = categories.map((c) => c.displayName);
        this.launchAddTransactionDialog();
      },
      error: () => this.snackBar.open('Failed to load accounts/categories. Please try again.', 'Dismiss', { duration: 5000 })
    });
  }

  private launchAddTransactionDialog() {
    const dialogRef = this.dialog.open(AddTransactionDialog, {
      width: '440px',
      data: { accounts: this.fullAccounts, categories: this.categories }
    });

    dialogRef.afterClosed().subscribe((result: CreateTransactionResult | undefined) => {
      if (!result) return;

      this.transactionService.createTransaction(result).subscribe({
        next: () => this.loadTransactions(),
        error: (err) => {
          const message = err?.error?.detail || 'Failed to add transaction.';
          this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        }
      });
    });
  }

  // ── REQ-2.2.3 Transaction Splitting ─────────────────────────────────────────

  openSplitDialog(row: Transaction) {
    const dialogRef = this.dialog.open(SplitTransactionDialog, {
      width: '480px',
      data: { merchant: row.merchant, totalAmount: row.amount, categories: this.categories }
    });

    dialogRef.afterClosed().subscribe((splits: SplitResult[] | undefined) => {
      if (!splits || splits.length === 0) return;

      this.transactionService.splitTransaction(row.id, splits).subscribe({
        next: () => this.loadTransactions(),
        error: (err) => {
          const message = err?.error?.detail || 'Failed to split transaction.';
          this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        }
      });
    });
  }

  // ── REQ-2.2.4 Spending Formula Exclusion ────────────────────────────────────

  toggleExcludeRow(row: Transaction) {
    this.transactionService.excludeTransaction(row.id, !row.isExcluded).subscribe({
      next: () => this.loadTransactions(),
      error: () => this.snackBar.open('Failed to update exclusion status.', 'Dismiss', { duration: 5000 })
    });
  }

  excludeSelected() {
    const ids = this.selection.selected.map(t => t.id);
    if (ids.length === 0) return;

    this.transactionService.bulkOperations({ transactionIds: ids, action: 'EXCLUDE' }).subscribe({
      next: () => this.loadTransactions(),
      error: () => this.snackBar.open('Failed to exclude selected transactions.', 'Dismiss', { duration: 5000 })
    });
  }

  // ── REQ-2.2.5 Status Promotion ───────────────────────────────────────────────

  approveRow(row: Transaction) {
    this.transactionService.approveTransaction(row.id).subscribe({
      next: () => this.loadTransactions(),
      error: () => this.snackBar.open('Failed to approve transaction.', 'Dismiss', { duration: 5000 })
    });
  }

  approveSelected() {
    const ids = this.selection.selected.map(t => t.id);
    if (ids.length === 0) return;

    this.transactionService.bulkOperations({ transactionIds: ids, action: 'APPROVE' }).subscribe({
      next: () => this.loadTransactions(),
      error: () => this.snackBar.open('Failed to approve selected transactions.', 'Dismiss', { duration: 5000 })
    });
  }

  // ── REQ-2.3 Manual Entries (hard delete; kept here since it shares the row menu/bulk bar) ──

  deleteRow(row: Transaction) {
    if (!window.confirm(`Delete transaction "${row.merchant}"? This cannot be undone.`)) return;

    this.transactionService.deleteTransaction(row.id).subscribe({
      next: () => this.loadTransactions(),
      error: () => this.snackBar.open('Failed to delete transaction.', 'Dismiss', { duration: 5000 })
    });
  }

  deleteSelected() {
    const targets = this.selection.selected.filter(t => t.isManual);
    const skipped = this.selection.selected.length - targets.length;

    if (targets.length === 0) {
      this.snackBar.open('Only manually-entered transactions can be deleted.', 'Dismiss', { duration: 5000 });
      return;
    }
    if (!window.confirm(`Delete ${targets.length} transaction(s)? This cannot be undone.`)) return;

    forkJoin(targets.map(t => this.transactionService.deleteTransaction(t.id))).subscribe({
      next: () => {
        if (skipped > 0) {
          this.snackBar.open(
            `Deleted ${targets.length} transaction(s). Skipped ${skipped} non-manual transaction(s).`,
            'Dismiss', { duration: 5000 }
          );
        }
        this.loadTransactions();
      },
      error: () => this.snackBar.open('Failed to delete selected transactions.', 'Dismiss', { duration: 5000 })
    });
  }

  categorizeSelected() {}
  exportSelected() {}

  // ── Detail panel wiring ──────────────────────────────────────────────────────

  onPanelCategoryChange(category: string) {
    const row = this.selectedTransaction();
    if (!row || !category || category === row.category) return;

    this.transactionService.updateTransaction(row.id, { category }).subscribe({
      next: () => this.loadTransactions(),
      error: () => this.snackBar.open('Failed to update category.', 'Dismiss', { duration: 5000 })
    });
    this.selectedTransaction.set({ ...row, category });
  }

  onPanelApprove() {
    const row = this.selectedTransaction();
    if (!row) return;
    this.approveRow(row);
    this.closePanel();
  }
}
