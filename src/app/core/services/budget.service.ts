import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type BudgetStatus = 'ACTIVE' | 'CLOSED';

export interface BudgetLine {
  lineId: string | null;
  budgetId: string | null;
  category: string;
  limitAmount: number;
  description: string | null;
  spentAmount: number | null;
}

export interface Budget {
  budgetId: string;
  userId: string;
  effectiveMonth: string;
  version: number;
  status: BudgetStatus;
  description: string | null;
  lines: BudgetLine[];
  createdAt: string | null;
}

export interface UpsertBudgetLinePayload {
  category: string;
  limitAmount: number;
}

// REQ-5.1 payload for PUT /api/v1/ledger/budgets. templateId is omitted here: REQ-5.3's
// server-side template catalog isn't implemented (see the Budgets page missing-logic notes), so
// the UI always sends explicit `lines` instead — which REQ-5.1 already treats as taking
// precedence over any templateId.
export interface UpsertBudgetPayload {
  effectiveMonth: string;
  lines: UpsertBudgetLinePayload[];
}

export interface AddLineItemPayload {
  category: string;
  limitAmount: number;
}

export interface UpdateLineItemLimitPayload {
  limitAmount: number;
}

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private apiUrl = '/api/v1/ledger/budgets';

  constructor(private http: HttpClient) {}

  // REQ-5.1 / REQ-5.4 — backed by getOrCreateBudgetFromPrevious: always returns a Budget, lazily
  // cloning the user's latest active budget (or an empty one) the first time a given month is
  // requested. Calling this for a month the user never intended to budget silently creates a row
  // for it — see the missing-logic notes for why that matters for how the UI uses this method.
  getBudgetForMonth(effectiveMonth: string): Observable<Budget> {
    const params = new HttpParams().set('month', effectiveMonth);
    return this.http.get<Budget>(this.apiUrl, { params });
  }

  upsertBudget(payload: UpsertBudgetPayload): Observable<Budget> {
    return this.http.put<Budget>(this.apiUrl, payload);
  }

  closeBudget(budgetId: string): Observable<Budget> {
    return this.http.post<Budget>(`${this.apiUrl}/${budgetId}/close`, {});
  }

  reopenBudget(budgetId: string): Observable<Budget> {
    return this.http.post<Budget>(`${this.apiUrl}/${budgetId}/reopen`, {});
  }

  // REQ-5.2 granular line-item operations.
  addLineItem(budgetId: string, payload: AddLineItemPayload): Observable<BudgetLine> {
    return this.http.post<BudgetLine>(`${this.apiUrl}/${budgetId}/lines`, payload);
  }

  updateLineItemLimit(budgetId: string, lineId: string, payload: UpdateLineItemLimitPayload): Observable<BudgetLine> {
    return this.http.put<BudgetLine>(`${this.apiUrl}/${budgetId}/lines/${lineId}`, payload);
  }

  removeLineItem(budgetId: string, lineId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${budgetId}/lines/${lineId}`);
  }
}
