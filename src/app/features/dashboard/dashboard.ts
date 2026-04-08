import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatGridListModule,
    MatTableModule,
    MatButtonModule,
    BaseChartDirective
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  summaryCards = [
    { title: 'Total Balance', amount: '$24,562.00', icon: 'account_balance', trend: '+2.4%', color: 'primary-blue' },
    { title: 'Monthly Income', amount: '$8,450.00', icon: 'trending_up', trend: '+5.1%', color: 'status-success' },
    { title: 'Monthly Expenses', amount: '$3,240.50', icon: 'trending_down', trend: '-1.2%', color: 'status-error' },
    { title: 'Net Savings', amount: '$5,209.50', icon: 'savings', trend: '+12.5%', color: 'status-info' }
  ];

  recentTransactions = [
    { date: '2025-03-08', merchant: 'Whole Foods', category: 'Groceries', amount: 142.50 },
    { date: '2025-03-07', merchant: 'Netflix', category: 'Entertainment', amount: 15.99 },
    { date: '2025-03-05', merchant: 'Shell Gas', category: 'Transport', amount: 45.00 },
    { date: '2025-03-01', merchant: 'TechCorp Salary', category: 'Income', amount: 4225.00 }
  ];
  
  displayedColumns: string[] = ['date', 'merchant', 'category', 'amount'];

  // Chart Properties
  public cashflowChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [ 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar' ],
    datasets: [
      { data: [ 6500, 7200, 8000, 8100, 8400, 8450 ], label: 'Income', backgroundColor: '#0F62FE' },
      { data: [ 2800, 4800, 4000, 3900, 4600, 3240 ], label: 'Expenses', backgroundColor: '#DA1E28' }
    ]
  };
  
  public cashflowChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
  };
}
