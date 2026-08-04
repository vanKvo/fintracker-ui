import { Component, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';

export interface CreateBudgetDialogData {
  categories: string[];
  defaultMonth: Date;
}

export type BudgetStarter = 'BLANK' | 'BASIC_LIVING' | 'AGGRESSIVE_SAVINGS';

export interface CreateBudgetLineDraft {
  category: string;
  limitAmount: number | null;
}

export interface CreateBudgetResult {
  effectiveMonth: string;
  lines: { category: string; limitAmount: number }[];
}

// REQ-5.3 "Quick Start Templates" specs a server-side template catalog
// (BudgetTemplateController, GET /api/v1/budget-templates) that is not implemented yet — see
// docs/fintracker-ledger-doc/ledger-5-budget-spec.md REQ-5.3 and the Budgets page missing-logic
// notes. Until that exists, "Basic Living" / "Aggressive Savings" are seeded client-side as
// starting points rather than fetched. REQ-5.1's "Template Customization" rule (fully editable
// before creation) still holds: these seed the same editable line list a from-scratch budget
// uses, and the request is always sent as explicit `lines`, never a `templateId`.
const STARTER_LINES: Record<Exclude<BudgetStarter, 'BLANK'>, CreateBudgetLineDraft[]> = {
  BASIC_LIVING: [
    { category: 'Rent/Mortgage', limitAmount: 1500 },
    { category: 'Groceries', limitAmount: 500 },
    { category: 'Utilities', limitAmount: 200 },
    { category: 'Transportation', limitAmount: 150 },
    { category: 'Insurance', limitAmount: 200 },
    { category: 'Dining Out', limitAmount: 100 },
    { category: 'Miscellaneous', limitAmount: 100 }
  ],
  AGGRESSIVE_SAVINGS: [
    { category: 'Rent/Mortgage', limitAmount: 1200 },
    { category: 'Savings Transfer', limitAmount: 1000 },
    { category: 'Groceries', limitAmount: 350 },
    { category: 'Utilities', limitAmount: 150 },
    { category: 'Transportation', limitAmount: 100 },
    { category: 'Dining Out', limitAmount: 50 },
    { category: 'Miscellaneous', limitAmount: 50 }
  ]
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

@Component({
  selector: 'app-create-budget-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatIconModule
  ],
  templateUrl: './create-budget-dialog.html',
  styleUrl: './create-budget-dialog.scss'
})
export class CreateBudgetDialog {
  categories: string[];
  months = MONTH_NAMES.map((label, value) => ({ value, label }));
  years: number[];

  starter = signal<BudgetStarter>('BLANK');
  month = signal(0);
  year = signal(0);
  lines = signal<CreateBudgetLineDraft[]>([]);

  newCategory = signal<string | null>(null);
  newLimit = signal<number | null>(null);

  // REQ-5.2 "Category Uniqueness" mirrored client-side so a doomed-to-409 add is never offered.
  availableCategories = computed(() => {
    const used = new Set(this.lines().map(l => l.category.toLowerCase()));
    return this.categories.filter(c => !used.has(c.toLowerCase()));
  });

  // REQ-5.1/5.2 Range Constraint: every drafted line needs a non-blank category and a
  // limitAmount in [0.00, 999999999.99]; a blank budget with zero lines is also valid.
  canSubmit = computed(() =>
    this.lines().every(l =>
      l.category.trim().length > 0
      && l.limitAmount !== null
      && l.limitAmount >= 0
      && l.limitAmount <= 999999999.99
    )
  );

  constructor(
    private dialogRef: MatDialogRef<CreateBudgetDialog>,
    @Inject(MAT_DIALOG_DATA) data: CreateBudgetDialogData
  ) {
    this.categories = data.categories;
    this.month.set(data.defaultMonth.getMonth());
    this.year.set(data.defaultMonth.getFullYear());
    const currentYear = data.defaultMonth.getFullYear();
    this.years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
  }

  selectStarter(starter: BudgetStarter): void {
    this.starter.set(starter);
    this.lines.set(starter === 'BLANK' ? [] : STARTER_LINES[starter].map(l => ({ ...l })));
  }

  updateLineLimit(index: number, rawValue: string): void {
    const value = rawValue === '' ? null : Number(rawValue);
    this.lines.update(lines => lines.map((l, i) => (i === index ? { ...l, limitAmount: value } : l)));
  }

  removeLine(index: number): void {
    this.lines.update(lines => lines.filter((_, i) => i !== index));
  }

  updateNewLimit(rawValue: string): void {
    this.newLimit.set(rawValue === '' ? null : Number(rawValue));
  }

  addLine(): void {
    const category = this.newCategory()?.trim();
    if (!category) return;

    this.lines.update(lines => [...lines, { category, limitAmount: this.newLimit() ?? 0 }]);
    this.newCategory.set(null);
    this.newLimit.set(null);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  confirm(): void {
    if (!this.canSubmit()) return;

    const effectiveMonth = `${this.year()}-${String(this.month() + 1).padStart(2, '0')}-01`;
    const result: CreateBudgetResult = {
      effectiveMonth,
      lines: this.lines().map(l => ({ category: l.category, limitAmount: l.limitAmount ?? 0 }))
    };
    this.dialogRef.close(result);
  }
}
