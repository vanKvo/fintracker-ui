import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
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
  displayedColumns: string[] = ['date', 'merchant', 'category', 'amount'];

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
    private zone: NgZone
  ) {}

  ngOnInit() {
    forkJoin({
      aggregations: this.dashboardService.getDashboardAggregations().pipe(catchError(() => of(null))),
      transactions: this.transactionService.getTransactions().pipe(catchError(() => of(null))),
      accounts: this.accountService.getAccounts().pipe(catchError(() => of([])))
    }).subscribe(({ aggregations, transactions, accounts }) => {
      // This app runs without zone.js (no polyfill, no provideZonelessChangeDetection()).
      // A raw HttpClient response resolving inside a plain .subscribe() callback doesn't go
      // through any path Angular's renderer treats as a change-detection trigger, so state
      // mutated here would sit in memory without ever reaching the DOM — until some unrelated
      // Angular-recognized event (a template event binding, router navigation, or a
      // zone-re-entrant CDK utility like ViewportRuler's window-resize listener) forces a
      // tick. That's why data appeared only after resizing the window: mat-sidenav-container's
      // internal ViewportRuler re-enters the zone on every resize. Wrapping the mutations in
      // zone.run() (same pattern already used in IdleTimerService) triggers the render directly.
      this.zone.run(() => {
        this.summaryStats.numberOfAccounts = accounts.length;

        if (aggregations) {
          this.summaryStats.totalBalance = '$' + (aggregations['Total Balance'] || '0.00');
          this.summaryStats.monthlyIncome = '$' + (aggregations['Monthly Income'] || '0.00');
          this.summaryStats.monthlyExpenses = '$' + (aggregations['Monthly Expenses'] || '0.00');
        } else {
          this.snackBar.open('Dashboard data failed to load.', 'Dismiss', { duration: 5000 });
        }

        if (transactions && Array.isArray(transactions)) {
          this.allTransactions = transactions;
          this.applyTimeRangeFilter();
        } else {
          this.snackBar.open('Transactions failed to load.', 'Dismiss', { duration: 5000 });
        }
      });
    });
  }

  onTimeRangeChange(_change: MatSelectChange) {
    this.zone.run(() => this.applyTimeRangeFilter());
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

  private applyTimeRangeFilter() {
    const { start, end } = this.getDateRangeForSelection(this.selectedTimeRange);
    const inRange = this.allTransactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    const sorted = [...inRange].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      const d = new Date(t.date);
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
