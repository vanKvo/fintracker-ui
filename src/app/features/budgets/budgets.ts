import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BudgetService, Budget, BudgetLine, BudgetStatus } from '../../core/services/budget.service';
import { CategoryService } from '../../core/services/category.service';
import { map } from 'rxjs/operators';
import { CreateBudgetDialog, CreateBudgetResult } from './create-budget-dialog/create-budget-dialog';
import { ConfirmDeleteDialog, ConfirmDeleteDialogData } from './confirm-delete-dialog/confirm-delete-dialog';
import { SaveTemplateDialog, SaveTemplateDialogData, SaveTemplateResult } from './save-template-dialog/save-template-dialog';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** One month the user actually holds a budget for. Every field is server-derived. */
export interface BudgetMonth {
  key: string;             // 'YYYY-MM'
  effectiveMonth: string;  // 'YYYY-MM-01'
  monthName: string;
  month: number;           // 1-12
  year: number;
  budgetId: string;
  status: BudgetStatus;
  lineCount: number;
}

export interface YearGroup {
  year: number;
  months: BudgetMonth[];
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
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
})
export class Budgets implements OnInit {
  // REQ-5.1 A.2. "My Budgets" lists budgets that exist, not a rolling window of every month that
  // could exist. The previous implementation generated 16 months client-side and discovered each
  // month's status by opening it — which, because GET /budgets?month= lazily creates, meant
  // browsing the sidebar silently minted budgets. getBudgetsForYear is a pure read, so the whole
  // list can now be server-derived.
  //
  // Years the user actually has budgets in, most recent first — the "starting budget year"
  // marked by their first budget is simply the last element.
  budgetYears = signal<number[]>([]);
  monthsByYear = new Map<number, BudgetMonth[]>();

  expandedYears: { [year: number]: boolean } = {};
  loadingYears = new Set<number>();

  initializing = signal(true);
  // Kept distinct from "no budgets": an empty account and an unreachable Ledger look identical
  // in the year list, and showing "No budgets created yet" to a user who has budgets but can't
  // reach the server would invite them to recreate work they already have.
  loadFailed = signal(false);
  loadingBudget = signal(false);
  deleting = signal(false);
  savingTemplate = signal(false);

  selectedMonth: BudgetMonth | null = null;
  selectedBudget: Budget | null = null;

  categories: string[] = [];
  activeFilter: 'category' | 'spendStatus' = 'category';

  newCategory = signal<string | null>(null);
  newLimit = signal<number | null>(null);

  // REQ-5.2 line-item editing. A limit is a spending ceiling, so it is read-only until the user
  // explicitly clicks the pencil — the previous always-live input committed on blur, which meant
  // a stray scroll over a number field could silently rewrite a budget.
  editingLineId = signal<string | null>(null);
  editLimit = signal<number | null>(null);

  readonly currentYear = new Date().getFullYear();

  constructor(
    private budgetService: BudgetService,
    private categoryService: CategoryService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // REQ-TS-01: the merged system + custom category list, not just the fixed system set —
    // see the equivalent note in transactions.ts's loadCategories().
    this.categoryService.getCategories().pipe(
      map((categories) => categories.map((c) => c.displayName))
    ).subscribe({
      next: (categories) => (this.categories = categories),
      error: () => this.snackBar.open('Failed to load categories.', 'Dismiss', { duration: 5000 })
    });

    this.loadBudgetYears();
  }

  // ── Year navigation ─────────────────────────────────────────────────────────

  /**
   * One call establishes the whole navigation tree: which years to offer, and whether the user
   * has any budgets at all. Only the current year is fetched eagerly — past years cost nothing
   * until the user expands them.
   */
  private loadBudgetYears() {
    this.initializing.set(true);

    this.budgetService.getBudgetYears().subscribe({
      next: (response) => {
        // An account with no budgets is a normal, successful outcome — never an error. Coerced
        // defensively so a null/absent body still lands on the empty state rather than throwing errors
        const years = response ?? [];
        this.budgetYears.set(years);
        this.loadFailed.set(false);
        this.initializing.set(false);

        if (years.length === 0) {
          return; // Brand new account — the empty state takes over.
        }

        // The current year is the default view. A user whose budgets are all in the past has no
        // current year in the list, so fall back to their most recent year instead of showing
        // an expanded-but-empty group.
        const defaultYear = years.includes(this.currentYear) ? this.currentYear : years[0];
        this.expandedYears[defaultYear] = true;
        this.loadYear(defaultYear, true);
      },
      error: (err) => {
        this.initializing.set(false);
        this.loadFailed.set(true);
        const status = err?.status ? ` (HTTP ${err.status})` : '';
        this.snackBar.open(
          `Couldn't reach the budget service${status}. Please try again.`,
          'Retry',
          { duration: 8000 }
        ).onAction().subscribe(() => this.loadBudgetYears());
      }
    });
  }

  /** True only when the server confirmed the account has no budgets. */
  get hasNoBudgets(): boolean {
    return !this.initializing() && !this.loadFailed() && this.budgetYears().length === 0;
  }

  /** True when the list is unknown because the request failed — a different message entirely. */
  get hasLoadError(): boolean {
    return !this.initializing() && this.loadFailed();
  }

  retryLoadBudgetYears() {
    this.loadBudgetYears();
  }

  get yearGroups(): YearGroup[] {
    return this.budgetYears().map(year => ({
      year,
      months: this.monthsByYear.get(year) ?? []
    }));
  }

  isYearLoading(year: number): boolean {
    return this.loadingYears.has(year);
  }

  /** Collapsing is free; expanding fetches the year once and remembers it. */
  toggleYear(year: number) {
    const expanding = !this.expandedYears[year];
    this.expandedYears[year] = expanding;

    if (expanding && !this.monthsByYear.has(year)) {
      this.loadYear(year, false);
    }
  }

  private loadYear(year: number, selectFirst: boolean) {
    if (this.loadingYears.has(year)) {
      return;
    }
    this.loadingYears.add(year);

    this.budgetService.getBudgetsForYear(year).subscribe({
      next: (budgets) => {
        this.loadingYears.delete(year);
        this.monthsByYear.set(year, budgets.map(b => this.toBudgetMonth(b)));

        if (selectFirst && !this.selectedMonth) {
          const months = this.monthsByYear.get(year) ?? [];
          if (months.length > 0) {
            this.selectMonth(months[0]);
          }
        }
      },
      error: (err) => {
        this.loadingYears.delete(year);
        // Leave the year unloaded rather than caching an empty list, so re-expanding retries.
        this.expandedYears[year] = false;
        const message = err?.error?.detail || `Failed to load budgets for ${year}.`;
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  // The listing already carries status and line items, so the sidebar renders from it directly —
  // no per-month follow-up request, and no lazily created budget as a side effect of navigating.
  private toBudgetMonth(budget: Budget): BudgetMonth {
    const [year, month] = budget.effectiveMonth.split('-').map(Number);
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      effectiveMonth: budget.effectiveMonth,
      monthName: MONTH_NAMES[month - 1],
      month,
      year,
      budgetId: budget.budgetId,
      status: budget.status,
      lineCount: budget.lines?.length ?? 0
    };
  }

  // ── Budget selection ────────────────────────────────────────────────────────

  selectMonth(option: BudgetMonth) {
    this.selectedMonth = option;
    // An edit belongs to the budget it was opened on; carrying it across months would let a
    // pending value land on a different budget's line.
    this.cancelLineEdit();
    this.loadingBudget.set(true);

    this.budgetService.getBudgetForMonth(option.effectiveMonth).subscribe({
      next: (budget) => {
        this.selectedBudget = budget;
        this.syncMonthFrom(budget);
        this.loadingBudget.set(false);
      },
      error: (err) => {
        this.loadingBudget.set(false);
        const message = err?.error?.detail || 'Failed to load budget for this month.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  /** Keeps the sidebar row in step with the detail pane after any write. */
  private syncMonthFrom(budget: Budget) {
    const [year] = budget.effectiveMonth.split('-').map(Number);
    const months = this.monthsByYear.get(year);
    if (!months) {
      return;
    }
    const index = months.findIndex(m => m.budgetId === budget.budgetId);
    const updated = this.toBudgetMonth(budget);
    if (index >= 0) {
      months[index] = updated;
    } else {
      months.push(updated);
      months.sort((a, b) => b.month - a.month);
    }
    if (this.selectedMonth?.budgetId === budget.budgetId) {
      this.selectedMonth = updated;
    }
  }

  private refreshSelectedBudget() {
    if (!this.selectedMonth) {
      return;
    }
    this.budgetService.getBudgetForMonth(this.selectedMonth.effectiveMonth).subscribe({
      next: (budget) => {
        this.selectedBudget = budget;
        this.syncMonthFrom(budget);
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

  // ── REQ-5.1 A.3 delete ──────────────────────────────────────────────────────

  /**
   * Only ACTIVE budgets carry a delete affordance: the Ledger rejects deleting a CLOSED budget
   * with 422 ("Immutability upon Closure"), so offering the control on a closed month would
   * promise an action the server will refuse. Reopening is the documented path.
   */
  canDelete(month: BudgetMonth): boolean {
    return month.status === 'ACTIVE';
  }

  confirmDeleteBudget(month: BudgetMonth, event: MouseEvent) {
    // The row itself selects a month; the delete icon must not do both.
    event.stopPropagation();

    const data: ConfirmDeleteDialogData = {
      monthLabel: `${month.monthName} ${month.year}`,
      lineCount: month.lineCount
    };

    this.dialog.open(ConfirmDeleteDialog, { width: '460px', data })
      .afterClosed()
      .subscribe((confirmed: boolean | undefined) => {
        if (confirmed) {
          this.deleteBudget(month);
        }
      });
  }

  private deleteBudget(month: BudgetMonth) {
    this.deleting.set(true);

    this.budgetService.deleteBudget(month.budgetId).subscribe({
      next: () => {
        this.deleting.set(false);
        this.removeMonthLocally(month);
        this.snackBar.open(`Budget for ${month.monthName} ${month.year} deleted.`, 'Dismiss',
          { duration: 4000 });
      },
      error: (err) => {
        this.deleting.set(false);
        const message = err?.error?.detail || 'Failed to delete this budget.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        // The local view is now suspect — a 404 means it was already gone, a 422 means it was
        // closed behind our back. Re-read the year rather than guessing which.
        this.monthsByYear.delete(month.year);
        this.loadYear(month.year, false);
      }
    });
  }

  /**
   * Prunes the deleted month from the tree without a round-trip. A year that loses its last
   * budget disappears from the navigation, which keeps {@link hasNoBudgets} honest: deleting
   * every budget returns the page to its empty state.
   */
  private removeMonthLocally(month: BudgetMonth) {
    const remaining = (this.monthsByYear.get(month.year) ?? [])
      .filter(m => m.budgetId !== month.budgetId);

    if (remaining.length === 0) {
      this.monthsByYear.delete(month.year);
      delete this.expandedYears[month.year];
      this.budgetYears.update(years => years.filter(y => y !== month.year));
    } else {
      this.monthsByYear.set(month.year, remaining);
    }

    if (this.selectedMonth?.budgetId !== month.budgetId) {
      return;
    }

    // The open budget was the one deleted — fall back to the nearest remaining month so the
    // detail pane never shows a budget that no longer exists.
    this.selectedMonth = null;
    this.selectedBudget = null;

    const fallback = remaining[0] ?? this.firstLoadedMonth();
    if (fallback) {
      this.selectMonth(fallback);
    }
  }

  private firstLoadedMonth(): BudgetMonth | null {
    for (const year of this.budgetYears()) {
      const months = this.monthsByYear.get(year);
      if (months && months.length > 0) {
        return months[0];
      }
    }
    return null;
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

  isEditingLine(line: BudgetLine): boolean {
    return !!line.lineId && this.editingLineId() === line.lineId;
  }

  startLineEdit(line: BudgetLine) {
    if (this.isClosed || !line.lineId) return;
    this.editingLineId.set(line.lineId);
    this.editLimit.set(line.limitAmount);
  }

  cancelLineEdit() {
    this.editingLineId.set(null);
    this.editLimit.set(null);
  }

  /**
   * REQ-5.1 B monetary rules, mirrored client-side so the Save button is disabled rather than the
   * user discovering the constraint through a 400: range [0.00, 999999999.99] and a maximum scale
   * of 2 decimal places, which the backend rejects outright rather than rounding.
   */
  isEditLimitValid(): boolean {
    const value = this.editLimit();
    if (value === null || value === undefined || Number.isNaN(value)) return false;
    if (value < 0 || value > 999999999.99) return false;
    return Math.round(value * 100) === Number((value * 100).toFixed(4));
  }

  saveLineEdit(line: BudgetLine) {
    if (!this.selectedBudget || this.isClosed || !line.lineId || !this.isEditLimitValid()) return;

    const value = this.editLimit()!;
    if (value === line.limitAmount) {
      this.cancelLineEdit(); // Nothing changed — don't spend a request bumping the version.
      return;
    }

    this.budgetService.updateLineItemLimit(this.selectedBudget.budgetId, line.lineId, { limitAmount: value }).subscribe({
      next: () => {
        this.cancelLineEdit();
        this.refreshSelectedBudget();
      },
      error: (err) => {
        const message = err?.error?.detail || 'Failed to update category limit.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        // Stay in edit mode so the user can correct the value rather than losing what they typed.
      }
    });
  }

  removeLine(line: BudgetLine) {
    if (!this.selectedBudget || !line.lineId) return;

    // A row being edited must not be deleted out from under the open editor.
    if (this.isEditingLine(line)) {
      this.cancelLineEdit();
    }

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

  // ── REQ-5.1 lifecycle: reopen ────────────────────────────────────────────────

  reopenSelectedBudget() {
    if (!this.selectedBudget || !this.isClosed) return;

    this.budgetService.reopenBudget(this.selectedBudget.budgetId).subscribe({
      next: (budget) => {
        this.selectedBudget = budget;
        this.syncMonthFrom(budget);
      },
      error: (err) => {
        const message = err?.error?.detail || 'Failed to reopen budget.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  // ── REQ-5.1 create ───────────────────────────────────────────────────────────

  openCreateBudgetDialog() {
    const defaultMonth = this.selectedMonth
      ? new Date(this.selectedMonth.year, this.selectedMonth.month - 1, 1)
      : new Date();

    const dialogRef = this.dialog.open(CreateBudgetDialog, {
      width: '480px',
      data: { categories: this.categories, defaultMonth }
    });

    dialogRef.afterClosed().subscribe((result: CreateBudgetResult | undefined) => {
      if (!result) return;

      // REQ-5.3: a template-backed budget goes through quick-start so Copy-on-Instantiate,
      // the 50-line merge ceiling and spend pre-population are all applied server-side. A blank
      // budget stays on REQ-5.1's upsert path.
      const create$ = result.templateId
        ? this.budgetService.quickStartBudget({
            effectiveMonth: result.effectiveMonth,
            templateId: result.templateId,
            customOverrides: result.lines.map(l => ({
              categoryName: l.category,
              limitAmount: l.limitAmount
            }))
          })
        : this.budgetService.upsertBudget({
            effectiveMonth: result.effectiveMonth,
            lines: result.lines
          });

      create$.subscribe({
        next: (budget) => {
          this.selectedBudget = budget;
          this.registerCreatedBudget(budget);
        },
        error: (err) => {
          const message = err?.error?.detail || 'Failed to create budget.';
          this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        }
      });
    });
  }

  // ── REQ-5.3 "Save as Template" ───────────────────────────────────────────────

  /** Only a budget with allocations is worth saving — an empty template seeds nothing. */
  get canSaveAsTemplate(): boolean {
    return !!this.selectedBudget && (this.selectedBudget.lines?.length ?? 0) > 0;
  }

  openSaveTemplateDialog() {
    const budget = this.selectedBudget;
    const month = this.selectedMonth;
    if (!budget || !month || !this.canSaveAsTemplate) return;

    // The user's own template names are fetched first so the uniqueness rule can be shown inline
    // rather than as a 409 after they've typed everything.
    this.budgetService.getBudgetTemplates().subscribe({
      next: (templates) => this.promptForTemplateName(budget.budgetId, month, templates
        .filter(t => !t.isSystem)
        .map(t => t.name)),
      // A failed catalog fetch must not block saving: the server's unique index still guards it,
      // and the user simply loses the inline warning.
      error: () => this.promptForTemplateName(budget.budgetId, month, [])
    });
  }

  private promptForTemplateName(budgetId: string, month: BudgetMonth, existingNames: string[]) {
    const data: SaveTemplateDialogData = {
      monthLabel: `${month.monthName} ${month.year}`,
      lineCount: this.selectedBudget?.lines?.length ?? 0,
      existingNames
    };

    this.dialog.open(SaveTemplateDialog, { width: '460px', data })
      .afterClosed()
      .subscribe((result: SaveTemplateResult | undefined) => {
        if (result) {
          this.saveAsTemplate(budgetId, result);
        }
      });
  }

  private saveAsTemplate(budgetId: string, result: SaveTemplateResult) {
    this.savingTemplate.set(true);

    this.budgetService.createBudgetTemplate({
      name: result.name,
      description: result.description,
      sourceBudgetId: budgetId
    }).subscribe({
      next: (template) => {
        this.savingTemplate.set(false);
        this.snackBar.open(`Saved "${template.name}" as a template.`, 'Dismiss', { duration: 4000 });
      },
      error: (err) => {
        this.savingTemplate.set(false);
        const message = err?.status === 409
          ? 'You already have a template with that name.'
          : err?.error?.detail || 'Failed to save this budget as a template.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
    });
  }

  /** A budget in a year the tree has never seen extends the navigation to cover it. */
  private registerCreatedBudget(budget: Budget) {
    const month = this.toBudgetMonth(budget);

    if (!this.budgetYears().includes(month.year)) {
      this.budgetYears.update(years => [...years, month.year].sort((a, b) => b - a));
    }
    if (!this.monthsByYear.has(month.year)) {
      this.monthsByYear.set(month.year, []);
    }
    this.expandedYears[month.year] = true;

    this.selectedMonth = month;
    this.syncMonthFrom(budget);
  }
}
