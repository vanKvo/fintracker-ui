import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export interface Account {
  accountId: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
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
}
