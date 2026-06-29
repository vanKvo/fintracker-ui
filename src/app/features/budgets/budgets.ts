import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { BudgetService } from '../../core/services/budget.service';
import { HttpClientModule } from '@angular/common/http';
import { OnInit } from '@angular/core';

export interface Budget {
  category: string;
  spent: number;
  allocated: number;
}

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
export class Budgets implements OnInit {
  displayedColumns: string[] = ['category', 'progress', 'spent', 'allocated', 'remaining', 'actions'];
  dataSource: Budget[] = [];

  constructor(private budgetService: BudgetService) {}

  ngOnInit() {
    this.budgetService.getBudgets().subscribe(data => {
      this.dataSource = data;
    });
  }

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
