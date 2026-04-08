import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

export interface Budget {
  category: string;
  spent: number;
  allocated: number;
}

const BUDGET_DATA: Budget[] = [
  { category: 'Groceries', spent: 420.50, allocated: 600 },
  { category: 'Entertainment', spent: 150.00, allocated: 200 },
  { category: 'Shopping', spent: 345.00, allocated: 300 }, // Over budget
  { category: 'Utilities', spent: 180.00, allocated: 250 },
  { category: 'Transport', spent: 110.00, allocated: 150 },
  { category: 'Health & Fitness', spent: 65.00, allocated: 100 }
];

@Component({
  selector: 'app-budgets',
  imports: [
    CommonModule,
    MatTableModule,
    MatProgressBarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
})
export class Budgets {
  displayedColumns: string[] = ['category', 'progress', 'spent', 'allocated', 'actions'];
  dataSource = BUDGET_DATA;

  getPercent(spent: number, allocated: number): number {
    return Math.min((spent / allocated) * 100, 100);
  }

  isWarning(spent: number, allocated: number): boolean {
    const percent = (spent / allocated) * 100;
    return percent >= 85 && percent < 100;
  }

  isDanger(spent: number, allocated: number): boolean {
    return spent >= allocated;
  }
}
