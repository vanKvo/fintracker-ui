import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

export interface BudgetLine {
  category: string;
  allocated: number;
  spent: number;
}

export interface MonthlyBudget {
  id: string;
  monthName: string;
  month: number;
  year: number;
  status: 'ACTIVE' | 'CLOSED';
  lines: BudgetLine[];
}

@Component({
  selector: 'app-budgets',
  imports: [
    CommonModule,
    FormsModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
})
export class Budgets implements OnInit {
  // Static budget dataset
  budgets: MonthlyBudget[] = [
    {
      id: '2026-01',
      monthName: 'January',
      month: 1,
      year: 2026,
      status: 'ACTIVE',
      lines: [
        { category: 'Groceries', allocated: 2200, spent: 850.5 },
        { category: 'Dining Out', allocated: 150, spent: 120 },
        { category: 'Utilities Group', allocated: 250, spent: 245 },
        { category: 'Truing Savings', allocated: 200, spent: 200 },
        { category: 'Dimtessions', allocated: 120, spent: 110 },
        { category: 'Prüinary Funds', allocated: 150, spent: 50 }
      ]
    },
    {
      id: '2025-12',
      monthName: 'December',
      month: 12,
      year: 2025,
      status: 'CLOSED',
      lines: [
        { category: 'Groceries', allocated: 2000, spent: 1950 },
        { category: 'Dining Out', allocated: 150, spent: 180 },
        { category: 'Utilities Group', allocated: 250, spent: 260 },
        { category: 'Truing Savings', allocated: 200, spent: 200 },
        { category: 'Dimtessions', allocated: 120, spent: 120 },
        { category: 'Prüinary Funds', allocated: 150, spent: 150 }
      ]
    },
    {
      id: '2025-11',
      monthName: 'November',
      month: 11,
      year: 2025,
      status: 'CLOSED',
      lines: [
        { category: 'Groceries', allocated: 18250, spent: 3470 },
        { category: 'Dining Out', allocated: 100, spent: 120 },
        { category: 'Utilities Group', allocated: 100, spent: 130 },
        { category: 'Truing Savings', allocated: 150, spent: 120 },
        { category: 'Dimtessions', allocated: 150, spent: 120 },
        { category: 'Dining Out', allocated: 100, spent: 120 },
        { category: 'Prüinary Funds', allocated: 90, spent: 120 }
      ]
    },
    {
      id: '2025-10',
      monthName: 'October',
      month: 10,
      year: 2025,
      status: 'CLOSED',
      lines: [
        { category: 'Groceries', allocated: 2200, spent: 2100 },
        { category: 'Dining Out', allocated: 150, spent: 130 },
        { category: 'Utilities Group', allocated: 250, spent: 280 },
        { category: 'Truing Savings', allocated: 200, spent: 200 },
        { category: 'Dimtessions', allocated: 120, spent: 120 },
        { category: 'Prüinary Funds', allocated: 150, spent: 140 }
      ]
    },
    {
      id: '2025-09',
      monthName: 'September',
      month: 9,
      year: 2025,
      status: 'CLOSED',
      lines: [
        { category: 'Groceries', allocated: 1800, spent: 2200 },
        { category: 'Dining Out', allocated: 100, spent: 180 },
        { category: 'Utilities Group', allocated: 200, spent: 250 },
        { category: 'Truing Savings', allocated: 100, spent: 100 },
        { category: 'Dimtessions', allocated: 100, spent: 150 },
        { category: 'Prüinary Funds', allocated: 100, spent: 120 }
      ]
    }
  ];

  selectedBudget!: MonthlyBudget;
  activeFilter: 'category' | 'spendStatus' = 'category';
  expandedYears: { [key: number]: boolean } = {};

  ngOnInit() {
    // Select November 2025 by default to match the mockup image state
    const defaultBudget = this.budgets.find(b => b.id === '2025-11');
    this.selectedBudget = defaultBudget || this.budgets[0];

    // Only show budgets of the current year and collapse monthly budgets of other years by default
    const currentYear = 2026;
    this.groupedBudgets.forEach(group => {
      this.expandedYears[group.year] = group.year === currentYear;
    });
  }

  selectBudget(budget: MonthlyBudget) {
    this.selectedBudget = budget;
  }

  setFilter(filter: 'category' | 'spendStatus') {
    this.activeFilter = filter;
  }

  toggleYear(year: number) {
    this.expandedYears[year] = !this.expandedYears[year];
  }

  // Group budgets by year for left panel
  get groupedBudgets() {
    const groups: { [key: number]: MonthlyBudget[] } = {};
    this.budgets.forEach(b => {
      if (!groups[b.year]) {
        groups[b.year] = [];
      }
      groups[b.year].push(b);
    });

    const sortedYears = Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a);

    return sortedYears.map(year => ({
      year,
      budgets: groups[year].sort((a, b) => b.month - a.month)
    }));
  }

  // Filtered categories to display in the middle column
  get filteredLines(): BudgetLine[] {
    if (this.activeFilter === 'spendStatus') {
      // Sort lines such that overbudget lines are listed first
      return [...this.selectedBudget.lines].sort((a, b) => {
        const aOver = a.spent > a.allocated ? 1 : 0;
        const bOver = b.spent > b.allocated ? 1 : 0;
        return bOver - aOver;
      });
    }
    return this.selectedBudget.lines;
  }

  // Calculations for Overview card
  get totalBudgeted(): number {
    return this.selectedBudget.lines.reduce((sum, line) => sum + (line.allocated || 0), 0);
  }

  get totalSpent(): number {
    return this.selectedBudget.lines.reduce((sum, line) => sum + (line.spent || 0), 0);
  }

  get remainingBalance(): number {
    return this.totalBudgeted - this.totalSpent;
  }

  isOverviewOverBudget(): boolean {
    return this.remainingBalance < 0;
  }

  // Calculations for progress and warnings
  getPercent(spent: number, allocated: number): number {
    if (!allocated) return 0;
    return Math.min((spent / allocated) * 100, 100);
  }

  isWarning(spent: number, allocated: number): boolean {
    if (!allocated) return false;
    const percent = (spent / allocated) * 100;
    return percent >= 85 && percent < 100;
  }

  isDanger(spent: number, allocated: number): boolean {
    return spent > allocated;
  }

  // Buttons actions
  openQuickTemplate() {
    alert(`Quick Template action triggered for ${this.selectedBudget.monthName} ${this.selectedBudget.year}`);
  }

  manageBudget() {
    alert(`Manage Budget action triggered for ${this.selectedBudget.monthName} ${this.selectedBudget.year}`);
  }
}

