import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TransactionService } from './transaction.service';

// TXT-01: the client mirrors the Ledger's transaction fields — type, direction, currency,
// isRecurring and linkedTransactionId — on read, filter and update.
describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const ledgerRow = {
    transactionId: 't1', accountId: 'a1', txDate: '2026-10-01', merchant: 'Store', category: 'Shopping',
    amount: 25, status: 'POSTED', source: 'MANUAL_ENTRY', tags: [], isExcluded: false, isManual: true,
    type: 'REFUND', direction: 'CREDIT', currency: 'CAD', isRecurring: true, linkedTransactionId: 't0',
  };

  it('maps type, direction, currency, isRecurring and linkedTransactionId onto each row', () => {
    let rows: any[] = [];
    service.getTransactions().subscribe(r => (rows = r));

    httpMock.expectOne('/api/v1/ledger/transactions').flush([ledgerRow]);
    httpMock.expectOne('/api/v1/ledger/accounts').flush([{ accountId: 'a1', accountName: 'Checking' }]);

    expect(rows[0]).toMatchObject({
      type: 'REFUND', direction: 'CREDIT', currency: 'CAD', isRecurring: true, linkedTransactionId: 't0',
    });
  });

  it('sends type and direction filters as query parameters', () => {
    service.getTransactions({ type: 'REFUND', direction: 'CREDIT' }).subscribe();

    const req = httpMock.expectOne(r => r.url === '/api/v1/ledger/transactions');
    expect(req.request.params.get('type')).toBe('REFUND');
    expect(req.request.params.get('direction')).toBe('CREDIT');
    req.flush([]);
    httpMock.expectOne('/api/v1/ledger/accounts').flush([]);
  });

  it('PATCHes type, direction, isRecurring and linkedTransactionId', () => {
    service.updateTransaction('t1', {
      type: 'REFUND', direction: 'CREDIT', isRecurring: false, linkedTransactionId: 't0',
    }).subscribe();

    const req = httpMock.expectOne('/api/v1/ledger/transactions/t1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      type: 'REFUND', direction: 'CREDIT', isRecurring: false, linkedTransactionId: 't0',
    });
    req.flush(null);
  });
});
