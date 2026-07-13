import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export interface Account {
  accountId: string;
  userId: string;
  accountName: string;
  accountType: string;
  accountNumberLast4?: string;
  owner?: string;
  currentBalance: number;
  syncMode?: string;
  createdAt?: string;
}

export interface CreateAccountRequest {
  accountName: string;
  accountType: string;
  accountNumber?: string;
  owner?: string;
  syncMode?: string;
}

export interface UpdateAccountRequest {
  accountName?: string;
  accountType?: string;
  accountNumber?: string;
  owner?: string;
  syncMode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private apiUrl = '/api/v1/ledger/accounts';

  constructor(private http: HttpClient) {}

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  createAccount(request: CreateAccountRequest): Observable<Account> {
    return this.http.post<Account>(this.apiUrl, request);
  }

  updateAccount(id: string, request: UpdateAccountRequest): Observable<Account> {
    return this.http.patch<Account>(`${this.apiUrl}/${id}`, request);
  }
}
