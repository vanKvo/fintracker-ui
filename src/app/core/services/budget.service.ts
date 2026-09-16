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

// REQ-5.3 "Quick Start Templates". Note the field names differ from BudgetLine on purpose: a
// template carries a `defaultLimit` (a starting suggestion), a budget line a `limitAmount` (a live
// ceiling). Copy-on-Instantiate is where one becomes the other.
export interface BudgetTemplateLine {
  lineId: string | null;
  templateId: string | null;
  categoryName: string;
  defaultLimit: number;
}

export interface BudgetTemplate {
  templateId: string;
  userId: string | null;   // null for the global system catalog
  name: string;
  description: string | null;
  isSystem: boolean;
  lines: BudgetTemplateLine[];
  createdAt: string | null;
}

export interface QuickStartBudgetPayload {
  effectiveMonth: string;   // YYYY-MM-01
  templateId: string | null;
  totalBudgetCap?: number | null;
  customOverrides: { categoryName: string; limitAmount: number }[];
}

export interface CreateBudgetTemplatePayload {
  name: string;
  description: string | null;
  // The server reads the allocations from this budget rather than trusting figures echoed back
  // by the client, so a template can never be saved with amounts the budget does not contain.
  sourceBudgetId: string;
}

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private apiUrl = '/api/v1/ledger/budgets';
  private templatesUrl = '/api/v1/ledger/budget-templates';

  constructor(private http: HttpClient) {}

  // REQ-5.1 / REQ-5.4 — backed by getOrCreateBudgetFromPrevious: always returns a Budget, lazily
  // cloning the user's latest active budget (or an empty one) the first time a given month is
  // requested. Calling this for a month the user never intended to budget silently creates a row
  // for it — see the missing-logic notes for why that matters for how the UI uses this method.
  getBudgetForMonth(effectiveMonth: string): Observable<Budget> {
    const params = new HttpParams().set('month', effectiveMonth);
    return this.http.get<Budget>(this.apiUrl, { params });
  }

  // REQ-5.1 A.2 "Get Budgets" — every budget that already exists in the year, most recent month
  // first, each enriched with spentAmount. Unlike getBudgetForMonth this is a pure read: it never
  // creates a budget for a month that has none, which is what makes it safe to call for a year
  // the user may never have budgeted in.
  getBudgetsForYear(year: number): Observable<Budget[]> {
    const params = new HttpParams().set('year', year);
    return this.http.get<Budget[]>(this.apiUrl, { params });
  }

  // The years the user actually holds budgets in, most recent first. An empty array is the
  // authoritative "no budgets created yet" signal — distinct from "the current year is empty",
  // which a user whose budgets are all in past years would also produce.
  getBudgetYears(): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/years`);
  }

  // REQ-5.1 A.3 "Delete Budget" — 204 on success. Rejected with 422 when the budget is CLOSED
  // (it must be reopened first) and 404 when it is already gone.
  deleteBudget(budgetId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${budgetId}`);
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

  // ── REQ-5.3 Quick Start Templates ──────────────────────────────────────────

  /** System catalog + the user's own custom templates, system-first then alphabetical. */
  getBudgetTemplates(): Observable<BudgetTemplate[]> {
    return this.http.get<BudgetTemplate[]>(this.templatesUrl);
  }

  /** REQ-5.3 "Copy-on-Instantiate" — 201 with the newly seeded budget. */
  quickStartBudget(payload: QuickStartBudgetPayload): Observable<Budget> {
    return this.http.post<Budget>(`${this.apiUrl}/quick-start`, payload);
  }

  /** "Save as Template" — 201, or 409 when the user already has a template with that name. */
  createBudgetTemplate(payload: CreateBudgetTemplatePayload): Observable<BudgetTemplate> {
    return this.http.post<BudgetTemplate>(this.templatesUrl, payload);
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
