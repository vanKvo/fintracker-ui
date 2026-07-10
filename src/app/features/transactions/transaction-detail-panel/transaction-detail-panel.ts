import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Transaction } from '../transactions';

@Component({
  selector: 'app-transaction-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './transaction-detail-panel.html',
  styleUrl: './transaction-detail-panel.scss'
})
export class TransactionDetailPanel {
  @Input() transaction: Transaction | null = null;
  @Input() categories: string[] = [];
  @Output() closePanel = new EventEmitter<void>();
  @Output() categoryChange = new EventEmitter<string>();
  @Output() approve = new EventEmitter<void>();

  isEditingCategory = false;

  onClose() {
    this.closePanel.emit();
  }

  startEditCategory() {
    this.isEditingCategory = true;
  }

  onCategorySelected(category: string) {
    this.isEditingCategory = false;
    if (this.transaction && category !== this.transaction.category) {
      this.categoryChange.emit(category);
    }
  }

  onApprove() {
    this.approve.emit();
  }
}
