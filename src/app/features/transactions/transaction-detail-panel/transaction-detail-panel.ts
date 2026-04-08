import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { Transaction } from '../transactions';

@Component({
  selector: 'app-transaction-detail-panel',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDividerModule, MatChipsModule],
  templateUrl: './transaction-detail-panel.html',
  styleUrl: './transaction-detail-panel.scss'
})
export class TransactionDetailPanel {
  @Input() transaction: Transaction | null = null;
  @Output() closePanel = new EventEmitter<void>();

  onClose() {
    this.closePanel.emit();
  }
}
