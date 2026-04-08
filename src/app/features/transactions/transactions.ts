import { Component, ViewChild, AfterViewInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SelectionModel } from '@angular/cdk/collections';
import { TransactionDetailPanel } from './transaction-detail-panel/transaction-detail-panel';

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  account: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Manual';
  tags?: string[];
  notes?: string;
  sourceStatementId?: string;
}

const ELEMENT_DATA: Transaction[] = [
  { id: '1', date: '2026-03-10', merchant: 'Starbucks', category: '-', account: 'Chase Checking', amount: -5.00, status: 'Pending', notes: 'Coffee' },
  { id: '2', date: '2026-03-10', merchant: 'ATM Cash', category: '-', account: 'Chase Checking', amount: -20.00, status: 'Pending' },
  { id: '3', date: '2026-03-09', merchant: 'Amazon', category: 'Shopping', account: 'Chase Checking', amount: -42.00, status: 'Approved' },
  { id: '4', date: '2026-03-08', merchant: 'Whole Foods', category: 'Groceries', account: 'Chase Checking', amount: -65.00, status: 'Approved' },
  { id: '5', date: '2026-03-08', merchant: 'Uber', category: 'Transport', account: 'Chase Checking', amount: -19.00, status: 'Manual' },
  { id: '6', date: '2026-03-01', merchant: 'TechCorp Salary', category: 'Income', account: 'Chase Checking', amount: 4225.00, status: 'Approved' }
];

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatMenuModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    TransactionDetailPanel
  ],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class Transactions implements AfterViewInit {
  displayedColumns: string[] = ['select', 'date', 'merchant', 'account', 'category', 'amount', 'status', 'actions'];
  dataSource = new MatTableDataSource<Transaction>(ELEMENT_DATA);
  selection = new SelectionModel<Transaction>(true, []);
  
  categories = [...new Set(ELEMENT_DATA.map(t => t.category))].filter(c => c !== '-');
  accounts = [...new Set(ELEMENT_DATA.map(t => t.account))];

  selectedCategory = 'All';
  selectedAccount = 'All';
  selectedTab = signal(0); // 0: All, 1: Pending, 2: Approved, 3: Manual
  TotalAmount = signal(0);
  
  selectedTransaction = signal<Transaction | null>(null);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.setupFilter();
    this.calculateTotal();
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.dataSource.data);
  }

  setupFilter() {
    this.dataSource.filterPredicate = (data: Transaction, filter: string) => {
      const searchTerms = JSON.parse(filter);
      const matchMerchant = data.merchant.toLowerCase().includes(searchTerms.text);
      const matchCategory = searchTerms.category === 'All' || data.category === searchTerms.category;
      const matchAccount = searchTerms.account === 'All' || data.account === searchTerms.account;
      
      let matchStatus = true;
      if (searchTerms.tab === 1) matchStatus = data.status === 'Pending';
      if (searchTerms.tab === 2) matchStatus = data.status === 'Approved';
      if (searchTerms.tab === 3) matchStatus = data.status === 'Manual';

      return matchMerchant && matchCategory && matchAccount && matchStatus;
    };
  }

  applyFilter() {
    const searchInput = document.querySelector('input[placeholder="Search by merchant..."]') as HTMLInputElement;
    const searchText = (searchInput ? searchInput.value : '').trim().toLowerCase();
    
    const filterValue = JSON.stringify({
      text: searchText,
      category: this.selectedCategory,
      account: this.selectedAccount,
      tab: this.selectedTab()
    });
    
    this.dataSource.filter = filterValue;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    
    this.calculateTotal();
  }

  onTabChange(tabIndex: number) {
    this.selectedTab.set(tabIndex);
    this.applyFilter();
  }

  calculateTotal() {
    const total = this.dataSource.filteredData.reduce((acc, curr) => acc + curr.amount, 0);
    this.TotalAmount.set(total);
  }

  openRow(row: Transaction) {
    this.selectedTransaction.set(row);
  }

  closePanel() {
    this.selectedTransaction.set(null);
  }

  approveSelected() {}
  categorizeSelected() {}
  deleteSelected() {}
  exportSelected() {}

  rowAction(action: string, transaction: Transaction) {
    console.log(`Action: ${action} on`, transaction);
  }
}
