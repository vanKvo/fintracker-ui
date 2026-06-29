import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
import { DashboardService } from '../../core/services/dashboard.service';
import { TransactionService } from '../../core/services/transaction.service';
import { catchError } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatGridListModule,
    MatTableModule,
    MatButtonModule,
    MatSnackBarModule,
    BaseChartDirective
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  summaryCards: any[] = [];
  recentTransactions: any[] = [];
  displayedColumns: string[] = ['date', 'merchant', 'category', 'amount'];

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
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    forkJoin({
      aggregations: this.dashboardService.getDashboardAggregations().pipe(catchError(err => of(null))),
      transactions: this.transactionService.getTransactions().pipe(catchError(err => of(null)))
    }).subscribe(({ aggregations, transactions }) => {
      // Setup Summary Cards
      if (aggregations) {
        // Map the aggregations object to summaryCards array or use it if it's already an array
        this.summaryCards = Array.isArray(aggregations) ? aggregations : [
           { title: 'Total Balance', amount: '$' + (aggregations['Total Balance'] || '0.00'), icon: 'account_balance', color: 'primary-blue' },
           { title: 'Monthly Income', amount: '$' + (aggregations['Monthly Income'] || '0.00'), icon: 'trending_up', color: 'status-success' },
           { title: 'Monthly Expenses', amount: '$' + (aggregations['Monthly Expenses'] || '0.00'), icon: 'trending_down', color: 'status-error' }
        ];
      } else {
        this.snackBar.open('Dashboard data failed to load.', 'Dismiss', { duration: 5000 });
      }

      // Setup Transactions & Charts
      if (transactions && Array.isArray(transactions)) {
        // Sort newest first
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.recentTransactions = transactions.slice(0, 4);
        this.computeCharts(transactions);
      } else {
        this.snackBar.open('Transactions failed to load.', 'Dismiss', { duration: 5000 });
      }
    });
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

    // Trend & Cashflow simplification: Grouping by Week/Month could go here
    // For now, assigning to placeholder structure to prevent crashing
    this.trendChartData = {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        { data: [200, 300, 100, 400], label: 'Income', borderColor: '#24A148', backgroundColor: 'rgba(36, 161, 72, 0.1)', fill: true },
        { data: [150, 200, 50, 300], label: 'Expenses', borderColor: '#DA1E28', backgroundColor: 'rgba(218, 30, 40, 0.1)', fill: true }
      ]
    };
  }
}
