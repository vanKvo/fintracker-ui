import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BudgetService, Budget, BudgetLine, BudgetStatus } from '../../core/services/budget.service';
import { TransactionService } from '../../core/services/transaction.service';
import { CreateBudgetDialog, CreateBudgetResult } from './create-budget-dialog/create-budget-dialog';

export interface MonthOption {
  key: string;
  effectiveMonth: string;
  monthName: string;
  month: number;
  year: number;
  date: Date;
}

@Component({
  selector: 'app-budgets',
  imports: [
    CommonModule,
    FormsModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
})
export class Budgets implements OnInit {
  // REQ-5.1/5.4 GET /budgets?month= is the only read path the Ledger exposes — there is no
  // "list my budgets" endpoint (see missing-logic notes). This rolling window is generated
  // entirely client-side so the left column has something to navigate; it does not reflect which
  // months actually have a budget until the user clicks into them (see statusByMonth below).
  monthOptions: MonthOption[] = [];
  expandedYears: { [key: number]: boolean } = {};

  // Populated lazily as the user visits months, since GET is the only source of truth for status
  // and we deliberately don't prefetch every visible month (that would silently auto-create a
  // budget row for every month merely rendered in the list — see missing-logic notes).
  statusByMonth = new Map<string, BudgetStatus>();

  selectedMonthOption!: MonthOption;
  selectedBudget: Budget | null = null;
  loadingBudget = signal(false);

  categories: string[] = [];

  activeFilter: 'category' | 'spendStatus' = 'category';

  newCategory = signal<string | null>(null);
  newLimit = signal<number | null>(null);

  constructor(
    private budgetService: BudgetService,
    private transactionService: TransactionService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.monthOptions = this.buildMonthOptions();

    const currentYear = new Date().getFullYear();
    this.groupedMonths.forEach(group => {
      this.expandedYears[group.year] = group.year === currentYear;
    });

    this.transactionService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
      error: () => this.snackBar.open('Failed to load categories.', 'Dismiss', { duration: 5000 })
    });

    const currentMonthOption = this.monthOptions.find(o => o.key === this.monthKey(new Date()));
    this.selectMonth(currentMonthOption ?? this.monthOptions[0]);
  }

  private buildMonthOptions(): MonthOption[] {
    const options: MonthOption[] = [];
    const now = new Date();
    const cursor = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 1);

    while (cursor <= end) {
      options.push(this.toMonthOption(new Date(cursor)));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return options.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private toMonthOption(date: Date): MonthOption {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return {
      key: this.monthKey(date),
      effectiveMonth: `${year}-${String(month).padStart(2, '0')}-01`,
      monthName: date.toLocaleString('en-US', { month: 'long' }),
      month,
      year,
      date: new Date(year, date.getMonth(), 1)
    };
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Inserts a month picked outside the rolling window (e.g. from the Create Budget dialog). */
  private ensureMonthOption(effectiveMonth: string): MonthOption {
    const existing = this.monthOptions.find(o => o.effectiveMonth === effectiveMonth);
    if (existing) return existing;

    const [year, month] = effectiveMonth.split('-').map(Number);
    const option = this.toMonthOption(new Date(year, month - 1, 1));
    this.monthOptions = [...this.monthOptions, option].sort((a, b) => b.date.getTime() - a.date.getTime());
    this.expandedYears[option.year] = true;
    return option;
  }

  get groupedMonths() {
    const groups: { [key: number]: MonthOption[] } = {};
    this.monthOptions.forEach(o => {
      if (!groups[o.year]) groups[o.year] = [];
      groups[o.year].push(o);
    });

    const sortedYears = Object.keys(groups).map(Number).sort((a, b) => b - a);
    return sortedYears.map(year => ({
      year,
      months: groups[year].sort((a, b) => b.month - a.month)
    }));
  }

  toggleYear(year: number) {
    this.expandedYears[year] = !this.expandedYears[year];
  }

  statusFor(option: MonthOption): BudgetStatus | null {
    return this.statusByMonth.get(option.key) ?? null;
  }

  // ── REQ-5.1 / REQ-5.4: load a month's budget ────────────────────────────────

  selectMonth(option: MonthOption) {
    this.selectedMonthOption = option;
    this.loadingBudget.set(true);

    this.budgetService.getBudgetForMonth(option.effectiveMonth).subscribe({
      next: (budget) => {
        this.selectedBudget = budget;
        this.statusByMonth.set(option.key, budget.status);
        this.loadingBudget.set(false);
      },
      error: (err) => {
        this.loadingBudget.set(false);
        const message = err?.error?.detail || 'Failed to load budget for this month.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  private refreshSelectedBudget() {
    this.budgetService.getBudgetForMonth(this.selectedMonthOption.effectiveMonth).subscribe({
      next: (budget) => {
        this.selectedBudget = budget;
        this.statusByMonth.set(this.selectedMonthOption.key, budget.status);
      },
      error: (err) => {
        const message = err?.error?.detail || 'Failed to refresh budget.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  get isClosed(): boolean {
    return this.selectedBudget?.status === 'CLOSED';
  }

  setFilter(filter: 'category' | 'spendStatus') {
    this.activeFilter = filter;
  }

  // Categories not already on the selected budget — REQ-5.2 "Category Uniqueness" mirrored
  // client-side so the add-category control never offers a doomed-to-409 choice.
  get availableCategories(): string[] {
    const used = new Set((this.selectedBudget?.lines ?? []).map(l => l.category.toLowerCase()));
    return this.categories.filter(c => !used.has(c.toLowerCase()));
  }

  get filteredLines(): BudgetLine[] {
    const lines = this.selectedBudget?.lines ?? [];
    if (this.activeFilter === 'spendStatus') {
      return [...lines].sort((a, b) => {
        const aOver = (a.spentAmount ?? 0) > a.limitAmount ? 1 : 0;
        const bOver = (b.spentAmount ?? 0) > b.limitAmount ? 1 : 0;
        return bOver - aOver;
      });
    }
    return lines;
  }

  // ── Overview totals ─────────────────────────────────────────────────────────

  get totalBudgeted(): number {
    return (this.selectedBudget?.lines ?? []).reduce((sum, l) => sum + (l.limitAmount || 0), 0);
  }

  get totalSpent(): number {
    return (this.selectedBudget?.lines ?? []).reduce((sum, l) => sum + (l.spentAmount || 0), 0);
  }

  get remainingBalance(): number {
    return this.totalBudgeted - this.totalSpent;
  }

  isOverviewOverBudget(): boolean {
    return this.remainingBalance < 0;
  }

  getPercent(spent: number, allocated: number): number {
    if (!allocated) return 0;
    return Math.min(((spent || 0) / allocated) * 100, 100);
  }

  isWarning(spent: number, allocated: number): boolean {
    if (!allocated) return false;
    const percent = ((spent || 0) / allocated) * 100;
    return percent >= 85 && percent < 100;
  }

  isDanger(spent: number, allocated: number): boolean {
    return (spent || 0) > allocated;
  }

  // ── REQ-5.2 granular line-item operations ───────────────────────────────────

  commitLineLimit(line: BudgetLine, rawValue: string) {
    if (!this.selectedBudget || this.isClosed || !line.lineId) return;

    const value = rawValue === '' ? NaN : Number(rawValue);
    if (Number.isNaN(value) || value < 0 || value > 999999999.99 || value === line.limitAmount) return;

    this.budgetService.updateLineItemLimit(this.selectedBudget.budgetId, line.lineId, { limitAmount: value }).subscribe({
      next: () => this.refreshSelectedBudget(),
      error: (err) => {
        const message = err?.error?.detail || 'Failed to update category limit.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        this.refreshSelectedBudget(); // revert the input to the persisted value
      }
    });
  }

  removeLine(line: BudgetLine) {
    if (!this.selectedBudget || !line.lineId) return;

    this.budgetService.removeLineItem(this.selectedBudget.budgetId, line.lineId).subscribe({
      next: () => this.refreshSelectedBudget(),
      error: (err) => {
        const message = err?.error?.detail || 'Failed to remove category.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  updateNewLimit(rawValue: string) {
    this.newLimit.set(rawValue === '' ? null : Number(rawValue));
  }

  addLine() {
    if (!this.selectedBudget) return;
    const category = this.newCategory();
    if (!category) return;

    this.budgetService.addLineItem(this.selectedBudget.budgetId, { category, limitAmount: this.newLimit() ?? 0 }).subscribe({
      next: () => {
        this.newCategory.set(null);
        this.newLimit.set(null);
        this.refreshSelectedBudget();
      },
      error: (err) => {
        const message = err?.error?.detail || 'Failed to add category.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  // ── REQ-5.1 lifecycle: close / reopen ───────────────────────────────────────

  toggleBudgetStatus() {
    if (!this.selectedBudget) return;

    const action$ = this.selectedBudget.status === 'ACTIVE'
      ? this.budgetService.closeBudget(this.selectedBudget.budgetId)
      : this.budgetService.reopenBudget(this.selectedBudget.budgetId);

    action$.subscribe({
      next: (budget) => {
        this.selectedBudget = budget;
        this.statusByMonth.set(this.selectedMonthOption.key, budget.status);
      },
      error: (err) => {
        const message = err?.error?.detail || 'Failed to update budget status.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  // ── REQ-5.1 create ───────────────────────────────────────────────────────────

  openCreateBudgetDialog() {
    const dialogRef = this.dialog.open(CreateBudgetDialog, {
      width: '480px',
      data: { categories: this.categories, defaultMonth: this.selectedMonthOption?.date ?? new Date() }
    });

    dialogRef.afterClosed().subscribe((result: CreateBudgetResult | undefined) => {
      if (!result) return;

      this.budgetService.upsertBudget({ effectiveMonth: result.effectiveMonth, lines: result.lines }).subscribe({
        next: (budget) => {
          const option = this.ensureMonthOption(result.effectiveMonth);
          this.selectedMonthOption = option;
          this.selectedBudget = budget;
          this.statusByMonth.set(option.key, budget.status);
        },
        error: (err) => {
          const message = err?.error?.detail || 'Failed to create budget.';
          this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        }
      });
    });
  }
}
