import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CategoryService, Category } from '../../../core/services/category.service';
import { DeleteCategoryDialog, DeleteCategoryDialogData, DeleteCategoryDialogResult }
  from '../delete-category-dialog/delete-category-dialog';

/**
 * REQ-TS-01: lets a user see the full category list (system categories they can't touch,
 * alongside their own), create new custom categories, rename or delete their own.
 *
 * Errors from the Ledger are RFC 9457 problem details — err.error.detail is a message the
 * backend already crafted to be safe to show; a raw err.message (transport-level text) is
 * never shown to the user (same convention as upload-statement-modal.ts).
 */
@Component({
  selector: 'app-manage-categories',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './manage-categories.html',
  styleUrl: './manage-categories.scss'
})
export class ManageCategories implements OnInit {
  loading = signal(true);
  categories = signal<Category[]>([]);

  newCategoryName = signal('');
  creating = signal(false);

  editingCategoryId = signal<string | null>(null);
  editingName = signal('');
  saving = signal(false);

  deletingCategoryId = signal<string | null>(null);

  systemCategories = computed(() => this.categories().filter((c) => c.level === 'SYSTEM'));
  customCategories = computed(() => this.categories().filter((c) => c.level === 'USER'));

  constructor(
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadCategories();
  }

  private loadCategories() {
    this.loading.set(true);
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load categories.', 'Dismiss', { duration: 5000 });
      }
    });
  }

  createCategory() {
    const name = this.newCategoryName().trim();
    if (!name || this.creating()) {
      return;
    }
    this.creating.set(true);
    this.categoryService.createCategory(name).subscribe({
      next: () => {
        this.creating.set(false);
        this.newCategoryName.set('');
        this.snackBar.open(`"${name}" was added.`, 'Dismiss', { duration: 3000 });
        this.loadCategories();
      },
      error: (err) => {
        this.creating.set(false);
        this.snackBar.open(err?.error?.detail || 'Could not create category.', 'Dismiss', { duration: 5000 });
      }
    });
  }

  startEdit(category: Category) {
    this.editingCategoryId.set(category.categoryId);
    this.editingName.set(category.displayName);
  }

  cancelEdit() {
    this.editingCategoryId.set(null);
    this.editingName.set('');
  }

  saveEdit(category: Category) {
    const name = this.editingName().trim();
    if (!name || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.categoryService.updateCategory(category.categoryId, name).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingCategoryId.set(null);
        this.snackBar.open('Category updated.', 'Dismiss', { duration: 3000 });
        this.loadCategories();
      },
      error: (err) => {
        this.saving.set(false);
        this.snackBar.open(err?.error?.detail || 'Could not update category.', 'Dismiss', { duration: 5000 });
      }
    });
  }

  deleteCategory(category: Category) {
    if (this.deletingCategoryId()) {
      return;
    }
    this.deletingCategoryId.set(category.categoryId);

    this.categoryService.getUsage(category.categoryId).subscribe({
      next: (usage) => {
        const dialogData: DeleteCategoryDialogData = {
          category,
          transactionCount: usage.transactionCount,
          otherCategories: this.categories().filter((c) => c.categoryId !== category.categoryId)
        };

        this.dialog.open<DeleteCategoryDialog, DeleteCategoryDialogData, DeleteCategoryDialogResult | null>(
          DeleteCategoryDialog, { data: dialogData, width: '440px' }
        ).afterClosed().subscribe((result) => {
          if (!result) {
            this.deletingCategoryId.set(null);
            return;
          }
          this.confirmDelete(category, result.reassignToCategoryId ?? undefined);
        });
      },
      error: (err) => {
        this.deletingCategoryId.set(null);
        this.snackBar.open(err?.error?.detail || 'Could not check category usage.', 'Dismiss', { duration: 5000 });
      }
    });
  }

  private confirmDelete(category: Category, reassignToCategoryId?: string) {
    this.categoryService.deleteCategory(category.categoryId, reassignToCategoryId).subscribe({
      next: () => {
        this.deletingCategoryId.set(null);
        this.snackBar.open(`"${category.displayName}" was deleted.`, 'Dismiss', { duration: 3000 });
        this.loadCategories();
      },
      error: (err) => {
        this.deletingCategoryId.set(null);
        this.snackBar.open(err?.error?.detail || 'Could not delete category.', 'Dismiss', { duration: 5000 });
      }
    });
  }
}
