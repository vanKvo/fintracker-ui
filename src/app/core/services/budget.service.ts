import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private apiUrl = '/api/v1/ledger/budgets';

  constructor(private http: HttpClient) {}

  getBudgets(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(data => data.flatMap(b => b.lines.map((l: any) => ({
        category: l.category,
        spent: l.spentAmount || 0,
        allocated: l.limitAmount || 0
      }))))
    );
  }

  saveBudget(payload: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }
}
