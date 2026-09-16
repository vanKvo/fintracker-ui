import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** REQ-TS-01. Mirrors the Ledger's CustomCategoryResponse — displayName is already the
 * Title Case, underscore-to-space form; nothing here needs further formatting. */
export interface Category {
  categoryId: string;
  displayName: string;
  level: 'SYSTEM' | 'USER';
}

export interface CategoryUsage {
  transactionCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = '/api/v1/ledger/categories';

  constructor(private http: HttpClient) {}

  /** The single combined, alphabetized list — system-level categories plus this user's own
   * custom ones (REQ-TS-01 #1/#4). */
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

  createCategory(categoryName: string): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, { categoryName });
  }

  updateCategory(categoryId: string, categoryName: string): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/${categoryId}`, { categoryName });
  }

  /** REQ-TS-01 #6: call before deleting, so the UI can prompt for a reassignment target
   * without waiting for the delete itself to be rejected. */
  getUsage(categoryId: string): Observable<CategoryUsage> {
    return this.http.get<CategoryUsage>(`${this.apiUrl}/${categoryId}/usage`);
  }

  /** reassignToCategoryId is required only when the category has referencing transactions
   * (see getUsage above) — omit it for an unused category. */
  deleteCategory(categoryId: string, reassignToCategoryId?: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${categoryId}`,
      reassignToCategoryId ? { body: { reassignToCategoryId } } : {});
  }
}
