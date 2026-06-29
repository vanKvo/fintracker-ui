import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountService } from './account.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private apiUrl = '/api/v1/ledger/transactions';

  constructor(private http: HttpClient, private accountService: AccountService) { }

  getTransactions(): Observable<any[]> {
    return combineLatest([
      this.http.get<any[]>(this.apiUrl),
      this.accountService.getAccounts()
    ]).pipe(
      map(([transactions, accounts]) => {
        const accountMap = new Map(accounts.map(a => [a.accountId, a.accountName]));
        
        return transactions.map(t => ({
          id: t.transactionId,
          date: t.txDate,
          merchant: t.merchant,
          category: t.category,
          account: accountMap.get(t.accountId) || 'Unknown Account',
          description: t.description || '',
          amount: t.amount,
          status: t.isManual ? 'Manual' : (t.status === 'PENDING_APPROVAL' ? 'Pending' : (t.status === 'POSTED' ? 'Approved' : 'Pending')),
          tags: t.tags || [],
          sourceStatementId: t.statementId
        }));
      })
    );
  }

  approveTransaction(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/approve`, {});
  }

  excludeTransaction(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/exclude`, {});
  }

  splitTransaction(id: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/split`, payload);
  }

  bulkOperations(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bulk`, payload);
  }

  deleteTransaction(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
