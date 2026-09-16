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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BudgetService, BudgetTemplate } from '../../../core/services/budget.service';

export interface CreateBudgetDialogData {
  categories: string[];
  defaultMonth: Date;
}

/**
 * REQ-5.3: the starter is either a blank budget or a template id from the server catalog. The
 * hardcoded STARTER_LINES that used to live here ("Basic Living", "Aggressive Savings") are now
 * seeded system templates in ledger.budget_templates — the catalog is their system of record, so
 * the two can no longer drift apart.
 */
export type BudgetStarter = 'BLANK' | 'TEMPLATE';

export interface CreateBudgetLineDraft {
  category: string;
  limitAmount: number | null;
}

export interface CreateBudgetResult {
  effectiveMonth: string;
  lines: { category: string; limitAmount: number }[];
  /** Set when the user picked a template, so the caller can use the REQ-5.3 quick-start endpoint. */
  templateId: string | null;
}

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
    MatIconModule,
    MatProgressBarModule
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

  // REQ-5.3 catalog, fetched when the dialog opens.
  templates = signal<BudgetTemplate[]>([]);
  selectedTemplateId = signal<string | null>(null);
  templatesLoading = signal(true);
  // Distinct from "no templates": a failed fetch must not be reported as an empty catalog.
  templatesFailed = signal(false);

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

  /** True only once the server confirmed the catalog is empty. */
  noTemplatesAvailable = computed(() =>
    !this.templatesLoading() && !this.templatesFailed() && this.templates().length === 0);

  constructor(
    private dialogRef: MatDialogRef<CreateBudgetDialog>,
    private budgetService: BudgetService,
    @Inject(MAT_DIALOG_DATA) data: CreateBudgetDialogData
  ) {
    this.categories = data.categories;
    this.month.set(data.defaultMonth.getMonth());
    this.year.set(data.defaultMonth.getFullYear());
    const currentYear = data.defaultMonth.getFullYear();
    this.years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.budgetService.getBudgetTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates ?? []);
        this.templatesFailed.set(false);
        this.templatesLoading.set(false);
      },
      error: () => {
        this.templatesLoading.set(false);
        this.templatesFailed.set(true);
      }
    });
  }

  selectTemplate(templateId: string): void {
    this.selectedTemplateId.set(templateId);
    const template = this.templates().find(t => t.templateId === templateId);
    // Previewed as editable drafts: REQ-5.3 "Template Line Item Overrides" lets the user adjust
    // the baseline before anything is persisted, and Copy-on-Instantiate means edits here can
    // never reach the template itself.
    this.lines.set((template?.lines ?? []).map(l => ({
      category: l.categoryName,
      limitAmount: l.defaultLimit
    })));
  }

  selectStarter(starter: BudgetStarter): void {
    this.starter.set(starter);
    if (starter === 'BLANK') {
      this.selectedTemplateId.set(null);
      this.lines.set([]);
      return;
    }
    // Preselect the first template so choosing "From a template" is never a dead end.
    const first = this.templates()[0];
    if (first) {
      this.selectTemplate(first.templateId);
    }
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
      lines: this.lines().map(l => ({ category: l.category, limitAmount: l.limitAmount ?? 0 })),
      templateId: this.starter() === 'TEMPLATE' ? this.selectedTemplateId() : null
    };
    this.dialogRef.close(result);
  }
}
