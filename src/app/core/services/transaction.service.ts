import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountService } from './account.service';

// TXT-01: the Ledger's five transaction types, and money out (DEBIT) / in (CREDIT).
export type TransactionType = 'EXPENSE' | 'INCOME' | 'REFUND' | 'TRANSFER' | 'ADJUSTMENT';
export type TransactionDirection = 'DEBIT' | 'CREDIT';

export interface UpdateTransactionPayload {
  category?: string;
  amount?: number;
  type?: TransactionType;
  direction?: TransactionDirection;
  isRecurring?: boolean;
  linkedTransactionId?: string;
}

export interface TransactionFilters {
  type?: TransactionType;
  direction?: TransactionDirection;
}

export interface SplitItemPayload {
  amount: number;
  category: string;
}

// REQ-2.3.1 "Manual Row Insertion" — mirrors the Ledger's ManualTransactionRequest. txDate is
// omitted (not sent as null) to defer to the backend's "defaults to today" behavior.
export interface CreateTransactionPayload {
  accountId: string;
  amount: number;
  merchant: string;
  category: string;
  txDate?: string;
  type: TransactionType;
  direction: TransactionDirection;
  currency?: string;
  isRecurring?: boolean;
  linkedTransactionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private apiUrl = '/api/v1/ledger/transactions';

  constructor(private http: HttpClient, private accountService: AccountService) { }

  getTransactions(filters: TransactionFilters = {}): Observable<any[]> {
    let params = new HttpParams();
    if (filters.type) params = params.set('type', filters.type);
    if (filters.direction) params = params.set('direction', filters.direction);

    return combineLatest([
      this.http.get<any[]>(this.apiUrl, { params }),
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
          status: t.isManual ? 'Manual' : (t.status === 'PENDING' ? 'Pending' : (t.status === 'POSTED' ? 'Approved' : 'Pending')),
          dbStatus: t.status,
          source: t.source,
          tags: t.tags || [],
          sourceStatementId: t.statementId,
          isExcluded: !!t.isExcluded,
          isManual: !!t.isManual,
          type: t.type,
          direction: t.direction,
          currency: t.currency,
          isRecurring: t.isRecurring ?? null,
          linkedTransactionId: t.linkedTransactionId ?? null
        }));
      })
    );
  }

  createTransaction(payload: CreateTransactionPayload): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }

  approveTransaction(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/approve`, {});
  }

  excludeTransaction(id: string, exclude: boolean): Observable<any> {
    const params = new HttpParams().set('exclude', exclude);
    return this.http.put<any>(`${this.apiUrl}/${id}/exclude`, {}, { params });
  }

  updateTransaction(id: string, payload: UpdateTransactionPayload): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, payload);
  }

  appendTags(id: string, tags: string[]): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/tags`, { tags });
  }

  splitTransaction(id: string, splits: SplitItemPayload[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/split`, { splits });
  }

  bulkOperations(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bulk`, payload);
  }

  deleteTransaction(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
