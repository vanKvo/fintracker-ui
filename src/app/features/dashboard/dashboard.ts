import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { DashboardService } from '../../core/services/dashboard.service';
import { TransactionService } from '../../core/services/transaction.service';
import { AccountService } from '../../core/services/account.service';
import { catchError } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';

interface Bill {
  id: string;
  payee: string;
  category: string;
  amount: number;
  dueDate: string;
  autopay: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    BaseChartDirective
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  summaryStats = {
    totalBalance: '$0.00',
    monthlyIncome: '$0.00',
    monthlyExpenses: '$0.00',
    numberOfAccounts: 0
  };
  recentTransactions: any[] = [];
  displayedColumns: string[] = ['date', 'merchant', 'account', 'category', 'amount'];

  /** Net cash position for the month so far — income minus spend, not a running balance. */
  netCashflowThisMonth = 0;
  /** Share of this month's income already spent, 0–100, for the spend-pace bar. */
  spendPacePercent = 0;

  /** Forward-looking half of the page: what is still owed, which Reports does not cover. */
  upcomingBills: Bill[] = [];
  billsTotal = 0;

  // Distinguishes "the ledger has nothing yet" (a normal new-account state) from "the request
  // failed" (an error banner + retry) — collapsing the two previously masked failures behind a
  // fabricated demo dataset. Tracked per section since each is fetched independently.
  summaryLoadFailed = false;
  transactionsLoadFailed = false;
  billsLoadFailed = false;

  selectedTimeRange = 'this-month';
  timeRanges = [
    { value: 'this-month', viewValue: 'This Month' },
    { value: 'last-month', viewValue: 'Last Month' },
    { value: 'last-3-months', viewValue: 'Last 3 Months' },
    { value: 'this-year', viewValue: 'This Year' }
  ];

  // Full, unfiltered transaction set fetched once — time range changes re-filter this
  // client-side rather than re-fetching, since the Ledger's transactions endpoint doesn't
  // currently accept a date-range query.
  private allTransactions: any[] = [];

  // Chart Properties (defaults to empty)
  public cashflowChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  public cashflowChartOptions: ChartOptions<'bar'> = { responsive: true, maintainAspectRatio: false };

  public categoryChartData: ChartConfiguration<'pie'>['data'] = { labels: [], datasets: [] };
  public categoryChartOptions: ChartOptions<'pie'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } };

  public trendChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  public trendChartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } };

  constructor(
    private dashboardService: DashboardService,
    private transactionService: TransactionService,
    private accountService: AccountService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    let aggregationsError: any = null;
    let transactionsError: any = null;

    forkJoin({
      aggregations: this.dashboardService.getDashboardAggregations().pipe(
        catchError(err => { aggregationsError = err; return of(null); })
      ),
      transactions: this.transactionService.getTransactions().pipe(
        catchError(err => { transactionsError = err; return of(null); })
      ),
      accounts: this.accountService.getAccounts().pipe(catchError(() => of([])))
    }).subscribe(({ aggregations, transactions, accounts }) => {
      // This app runs zoneless (Angular 21, no zone.js polyfill), so mutating plain component
      // fields from an HttpClient subscribe callback does not schedule a render on its own —
      // the new values sit in memory until something else triggers a tick, which is why the
      // data only appeared after resizing the window. markForCheck() notifies the zoneless
      // change-detection scheduler directly, which is the supported way to publish state that
      // isn't held in signals. (NgZone.run() cannot do this here: without zone.js the injected
      // NgZone is a NoopNgZone whose run() just invokes the callback and notifies nobody.)
      this.summaryStats.numberOfAccounts = accounts.length;

      if (aggregations) {
        this.summaryLoadFailed = false;
        this.summaryStats.totalBalance = this.formatCurrency(aggregations['Total Balance']);
        this.summaryStats.monthlyIncome = this.formatCurrency(aggregations['Monthly Income']);
        this.summaryStats.monthlyExpenses = this.formatCurrency(aggregations['Monthly Expenses']);
        this.updateDerivedStats(
          this.toNumber(aggregations['Monthly Income']),
          this.toNumber(aggregations['Monthly Expenses'])
        );
      } else {
        this.summaryLoadFailed = true;
        const message = aggregationsError?.error?.detail || 'Failed to load dashboard summary.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }

      if (Array.isArray(transactions)) {
        this.transactionsLoadFailed = false;
        this.allTransactions = transactions;
        this.applyTimeRangeFilter();
      } else {
        this.transactionsLoadFailed = true;
        this.allTransactions = [];
        this.applyTimeRangeFilter();
        const message = transactionsError?.error?.detail || 'Failed to load transactions.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      }

      this.loadBills();
      this.cdr.markForCheck();
    });
  }

  loadBills() {
    this.dashboardService.getBills().subscribe({
      next: bills => {
        this.billsLoadFailed = false;
        this.upcomingBills = bills ?? [];
        this.billsTotal = this.upcomingBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
        this.cdr.markForCheck();
      },
      error: err => {
        this.billsLoadFailed = true;
        this.upcomingBills = [];
        this.billsTotal = 0;
        const message = err?.error?.detail || 'Failed to load upcoming bills.';
        this.snackBar.open(message, 'Dismiss', { duration: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  private updateDerivedStats(income: number, expenses: number) {
    this.netCashflowThisMonth = income - expenses;
    this.spendPacePercent = income > 0 ? Math.min(100, (expenses / income) * 100) : 0;
  }

  private toNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? '0').replace(/[^0-9.-]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /** The aggregations endpoint returns raw numbers/strings; format them rather than concatenating '$'. */
  private formatCurrency(value: unknown): string {
    return this.toNumber(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  /** Days from today until a bill's due date, floored at 0. */
  daysUntil(dueDate: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = this.parseLocalDate(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((due.getTime() - today.getTime()) / 86400000));
  }

  /** Bills inside a week are the ones worth drawing the eye to. */
  billUrgency(dueDate: string): 'soon' | 'upcoming' {
    return this.daysUntil(dueDate) <= 7 ? 'soon' : 'upcoming';
  }

  onTimeRangeChange(_change: MatSelectChange) {
    // No markForCheck() needed: this runs from a template event binding, which the zoneless
    // scheduler already treats as a change-detection trigger.
    this.applyTimeRangeFilter();
  }

  hasChartData(data: ChartConfiguration<any>['data']): boolean {
    return !!data.labels?.length;
  }

  private getDateRangeForSelection(value: string): { start: Date; end: Date } {
    const now = new Date();
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    switch (value) {
      case 'last-month': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case 'last-3-months':
        return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: endOfMonth(now) };
      case 'this-year':
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
      case 'this-month':
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }

  /**
   * Parses the Ledger's date-only `txDate` ("YYYY-MM-DD") in the LOCAL timezone.
   *
   * `new Date('2026-08-01')` is specified to parse a date-only string as UTC midnight, which in
   * any negative-offset timezone resolves to 2026-07-31 locally. Every range boundary below is
   * built from local-time constructors, so the mismatch pushed each 1st-of-month transaction —
   * rent and the first paycheck, the two largest rows — into the previous month's bucket.
   */
  private parseLocalDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      // Full timestamps already carry an offset, so the default parse is correct for them.
      return new Date(value);
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  private applyTimeRangeFilter() {
    const { start, end } = this.getDateRangeForSelection(this.selectedTimeRange);
    const inRange = this.allTransactions.filter(t => {
      if (!t.date) return false;
      const d = this.parseLocalDate(t.date);
      return d >= start && d <= end;
    });

    const sorted = [...inRange].sort(
      (a, b) => this.parseLocalDate(b.date).getTime() - this.parseLocalDate(a.date).getTime()
    );
    this.recentTransactions = sorted.slice(0, 4);
    this.computeCharts(inRange);
  }

  computeCharts(transactions: any[]) {
    // Pie Chart: Spends by Category
    const spends = transactions.filter(t => t.amount < 0);
    const categoryTotals: Record<string, number> = {};
    spends.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    });
    this.categoryChartData = {
      labels: Object.keys(categoryTotals),
      datasets: [{
        data: Object.values(categoryTotals),
        backgroundColor: ['#0F62FE', '#78A9FF', '#24A148', '#F1C21B', '#DA1E28', '#8A3FFC'],
        hoverOffset: 4
      }]
    };

    // Cashflow (bar) & Spending Trend (line): both driven by the same canonical set of
    // month buckets for the selected time range — e.g. "This Year" always shows Jan through
    // the current month, "Last 3 Months" always shows exactly 3 months — rather than only
    // whichever months happen to have transactions, so a month with zero activity still
    // shows as a zero-value bar/point instead of being silently omitted.
    const buckets = this.getMonthBucketsForSelection(this.selectedTimeRange);
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};
    buckets.forEach(b => monthlyTotals[b.key] = { income: 0, expenses: 0 });

    transactions.forEach(t => {
      if (!t.date) return;
      const d = this.parseLocalDate(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyTotals[key]) return;
      if (t.amount >= 0) monthlyTotals[key].income += t.amount;
      else monthlyTotals[key].expenses += Math.abs(t.amount);
    });

    const labels = buckets.map(b => b.label);
    const incomeSeries = buckets.map(b => monthlyTotals[b.key].income);
    const expenseSeries = buckets.map(b => monthlyTotals[b.key].expenses);

    this.cashflowChartData = {
      labels,
      datasets: [
        { data: incomeSeries, label: 'Income', backgroundColor: '#24A148' },
        { data: expenseSeries, label: 'Expenses', backgroundColor: '#DA1E28' }
      ]
    };

    this.trendChartData = {
      labels,
      datasets: [
        { data: incomeSeries, label: 'Income', borderColor: '#24A148', backgroundColor: 'rgba(36, 161, 72, 0.1)', fill: true },
        { data: expenseSeries, label: 'Expenses', borderColor: '#DA1E28', backgroundColor: 'rgba(218, 30, 40, 0.1)', fill: true }
      ]
    };
  }

  private getMonthBucketsForSelection(value: string): { key: string; label: string }[] {
    const now = new Date();
    const buckets: { key: string; label: string }[] = [];
    const pushMonth = (year: number, month: number) => {
      buckets.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
    };

    switch (value) {
      case 'last-month': {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        pushMonth(d.getFullYear(), d.getMonth());
        break;
      }
      case 'last-3-months':
        for (let i = 2; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          pushMonth(d.getFullYear(), d.getMonth());
        }
        break;
      case 'this-year':
        for (let m = 0; m <= now.getMonth(); m++) {
          pushMonth(now.getFullYear(), m);
        }
        break;
      case 'this-month':
      default:
        pushMonth(now.getFullYear(), now.getMonth());
    }

    return buckets;
  }
}
