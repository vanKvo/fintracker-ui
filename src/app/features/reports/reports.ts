import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-reports',
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    BaseChartDirective
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  selectedTimeRange = 'this-month';
  timeRanges = [
    { value: 'this-month', viewValue: 'This Month' },
    { value: 'last-month', viewValue: 'Last Month' },
    { value: 'last-3-months', viewValue: 'Last 3 Months' },
    { value: 'this-year', viewValue: 'This Year' }
  ];

  // Spending by Category Pie Chart configuration
  public categoryChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Other'],
    datasets: [{
      data: [1500, 600, 300, 250, 150, 200],
      backgroundColor: [
        '#0F62FE', // Primary Blue
        '#78A9FF', // Secondary Light Blue
        '#24A148', // Status Success
        '#F1C21B', // Status Warning
        '#DA1E28', // Status Error
        '#8A3FFC'  // Purple
      ],
      hoverOffset: 4
    }]
  };
  
  public categoryChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' }
    }
  };

  // Income vs Expense Trend Line Chart configuration
  public trendChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        data: [2000, 2200, 1800, 2450],
        label: 'Income',
        borderColor: '#24A148',
        backgroundColor: 'rgba(36, 161, 72, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        data: [1200, 1100, 950, 1400],
        label: 'Expenses',
        borderColor: '#DA1E28',
        backgroundColor: 'rgba(218, 30, 40, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  public trendChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' }
    }
  };
}
