import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountService } from './account.service';

@Injectable({
  providedIn: 'root'
})
export class StatementService {
  private apiUrl = '/api/v1/ledger/statements';

  constructor(private http: HttpClient, private accountService: AccountService) {}

  getStatements(): Observable<any[]> {
    return combineLatest([
      this.http.get<any[]>(this.apiUrl),
      this.accountService.getAccounts()
    ]).pipe(
      map(([statements, accounts]) => {
        const accountMap = new Map(accounts.map(a => [a.accountId, a.accountName]));

        return statements.map(s => ({
          id: s.statementId,
          period: s.statementMonth,
          description: s.description || '',
          account: accountMap.get(s.accountId) || 'Unknown Account',
          transactions: s.txCount,
          pending: s.pendingCount,
          approved: s.approvedCount,
          status: s.status === 'PROCESSING' ? 'Processing' : (s.status === 'NEEDS_ATTENTION' ? 'Needs Attention' : (s.status === 'COMPLETED' ? 'Completed' : 'Failed'))
        }));
      })
    );
  }

  deleteStatement(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
