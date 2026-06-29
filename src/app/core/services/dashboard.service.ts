import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = '/api/v1/ledger';

  constructor(private http: HttpClient) {}

  getDashboardAggregations(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/aggregations`).pipe(
      map(res => ({
        'Total Balance': res.totalBalance,
        'Monthly Income': res.monthlyIncome,
        'Monthly Expenses': res.monthlyExpenses,
        'Cash Flow': res.cashFlow,
        'Net Saving': res.netSaving
      }))
    );
  }

  getBills(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/bills`);
  }

  payBill(id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bills/${id}/pay`, {});
  }
}
