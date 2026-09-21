import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { StatementService, findDateColumnIndex, parseCsvRows, parseFlexibleDate } from './statement.service';

/** timer(0, n) emits asynchronously, so the first poll request only exists after a macrotask. */
const flushPoll = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('StatementService', () => {
  let service: StatementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StatementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts to /initiate-upload and returns the 202 job object', () => {
    let result: any;
    service
      .initiateUpload({
        accountId: 'acc-1',
        sourceFormat: 'CSV',
        fileName: 'stmt.csv',
        bankId: 'chase',
        openingDate: '2026-04-01',
        closingDate: '2026-04-30',
        contentHash: 'a'.repeat(64),
      })
      .subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/ledger/statements/initiate-upload');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.bankId).toBe('chase');
    // REQ-STMT-03/07: the hash and the full range are part of every upload request now, and
    // statementMonth is gone — the server derives the month from closingDate.
    expect(req.request.body.contentHash).toBe('a'.repeat(64));
    expect(req.request.body.openingDate).toBe('2026-04-01');
    expect(req.request.body.closingDate).toBe('2026-04-30');
    expect(req.request.body.statementMonth).toBeUndefined();
    req.flush({ jobId: 'stmt-1', status: 'PROCESSING', uploadUrl: 'https://s3.example.com/x', s3ObjectKey: 'statements/stmt-1' });

    expect(result.jobId).toBe('stmt-1');
    expect(result.uploadUrl).toBe('https://s3.example.com/x');
  });

  it('REQ-STMT-05: overwriteStatementId is sent when the user chose to replace a statement', () => {
    service
      .initiateUpload({
        accountId: 'acc-1',
        sourceFormat: 'CSV',
        fileName: 'stmt.csv',
        bankId: 'chase',
        openingDate: '2026-04-01',
        closingDate: '2026-04-30',
        contentHash: 'b'.repeat(64),
        overwriteStatementId: 'old-stmt',
      })
      .subscribe();

    const req = httpMock.expectOne('/api/v1/ledger/statements/initiate-upload');
    expect(req.request.body.overwriteStatementId).toBe('old-stmt');
    req.flush({ jobId: 'stmt-2', status: 'PROCESSING', uploadUrl: 'https://s3/x', s3ObjectKey: 'k' });
  });

  it('REQ-STMT-03: computeContentHash returns the file\'s SHA-256 as 64 lowercase hex chars', async () => {
    // Known-answer test: SHA-256 of the empty input. A hash function that is subtly wrong (wrong
    // algorithm, wrong encoding) still produces a plausible-looking 64-char string, so comparing
    // against a fixed expected digest is the only assertion that would catch it.
    const file = new File([], 'empty.csv');
    // jsdom's File lacks arrayBuffer(), which every target browser implements. Patched here so
    // the test exercises the real hashing path rather than the service being written around jsdom.
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });

    const hash = await service.computeContentHash(file);
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('uploadToS3 sets the exact x-amz-meta-* headers the presign call signed', () => {
    const file = new File(['a,b,c'], 'stmt.csv', { type: 'text/csv' });
    service
      .uploadToS3('https://s3.example.com/put-target', file, {
        userId: 'user-1',
        statementId: 'stmt-1',
        accountId: 'acc-1',
        bankId: 'chase',
      })
      .subscribe();

    const req = httpMock.expectOne('https://s3.example.com/put-target');
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('x-amz-meta-user-id')).toBe('user-1');
    expect(req.request.headers.get('x-amz-meta-statement-id')).toBe('stmt-1');
    expect(req.request.headers.get('x-amz-meta-account-id')).toBe('acc-1');
    expect(req.request.headers.get('x-amz-meta-bank-id')).toBe('chase');
    req.flush(null);
  });

  it('uploadToS3 omits the bank-id header entirely when not a CSV upload', () => {
    const file = new File(['%PDF-1.4'], 'stmt.pdf', { type: 'application/pdf' });
    service.uploadToS3('https://s3.example.com/put-target', file, {
      userId: 'user-1',
      statementId: 'stmt-1',
      accountId: 'acc-1',
    }).subscribe();

    const req = httpMock.expectOne('https://s3.example.com/put-target');
    expect(req.request.headers.has('x-amz-meta-bank-id')).toBe(false);
    req.flush(null);
  });

  it('confirmMapping posts bank_id and confirmed_mapping in snake_case to match the pipeline API', () => {
    service.confirmMapping('stmt-1', 'chase', { date: 'Posting Date', merchant: 'Description', amount: 'Amount' }).subscribe();

    const req = httpMock.expectOne('/api/v1/pipeline/jobs/stmt-1/mapping-confirmation');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      bank_id: 'chase',
      confirmed_mapping: { date: 'Posting Date', merchant: 'Description', amount: 'Amount' },
    });
    req.flush(null);
  });

  it('getJobStatus polls the statement_id-keyed jobs endpoint', () => {
    service.getJobStatus('stmt-1').subscribe();
    const req = httpMock.expectOne('/api/v1/pipeline/jobs/stmt-1');
    expect(req.request.method).toBe('GET');
    req.flush({ jobId: 'stmt-1', status: 'COMPLETED', error: null });
  });

  // REQ-STMT-04, and the Shared Contract's explicit MUST: a waiting status missing from the stop
  // condition does not fail loudly — the poller keeps spinning to its ceiling and the user is
  // never prompted, which presents as a hung upload rather than a bug.
  it('REQ-STMT-04: polling stops on PENDING_DUPLICATE_RESOLUTION and hands the payload to the caller', async () => {
    const seen: any[] = [];
    let completed = false;
    service.pollJobStatus('stmt-1', 100_000).subscribe({
      next: (r) => seen.push(r),
      complete: () => (completed = true),
    });

    await flushPoll();
    httpMock.expectOne('/api/v1/pipeline/jobs/stmt-1').flush({
      jobId: 'stmt-1',
      status: 'PENDING_DUPLICATE_RESOLUTION',
      error: null,
      duplicate: {
        matchType: 'CONTENT_FINGERPRINT',
        existingStatementId: 'old-stmt',
        existingUploadDate: '2026-08-27T10:15:00Z',
        existingTransactionCount: 34,
      },
    });

    expect(completed).toBe(true);
    expect(seen.length).toBe(1);
    expect(seen[0].duplicate.existingStatementId).toBe('old-stmt');
  });

  it('polling still stops on PENDING_MAPPING_CONFIRMATION — the new status did not displace it', async () => {
    let completed = false;
    service.pollJobStatus('stmt-1', 100_000).subscribe({ complete: () => (completed = true) });
    await flushPoll();
    httpMock.expectOne('/api/v1/pipeline/jobs/stmt-1').flush({
      jobId: 'stmt-1',
      status: 'PENDING_MAPPING_CONFIRMATION',
      error: null,
    });
    expect(completed).toBe(true);
  });

  it('REQ-STMT-08: a FAILED status carries the errorCode and the matched statement through to the caller', async () => {
    let last: any;
    service.pollJobStatus('stmt-1', 100_000).subscribe({ next: (r) => (last = r) });
    await flushPoll();
    httpMock.expectOne('/api/v1/pipeline/jobs/stmt-1').flush({
      jobId: 'stmt-1',
      status: 'FAILED',
      error: null,
      errorCode: 'SERVER_DUPLICATE_DETECTED',
      duplicate: {
        matchType: 'EXACT_FILE',
        existingStatementId: 'old-stmt',
        existingUploadDate: '2026-08-27T10:15:00Z',
        existingTransactionCount: 12,
      },
    });

    expect(last.errorCode).toBe('SERVER_DUPLICATE_DETECTED');
    expect(last.duplicate.existingTransactionCount).toBe(12);
  });

  // REQ-STMT-09
  it('detects the opening/closing date range from a CSV with a "date" header', async () => {
    const csv = 'date,merchant,amount\n01/15/2026,Coffee Shop,4.50\n01/03/2026,Grocery,62.10\n01/28/2026,Gas Station,40.00\n';
    const file = new File([csv], 'stmt.csv', { type: 'text/csv' });

    const range = await service.detectCsvDateRange(file);

    expect(range).toEqual({ openingDate: '2026-01-03', closingDate: '2026-01-28' });
  });

  it('falls back to the highest-density date column when no header is named "date"', async () => {
    const csv = 'transaction_date,payee,total\n2026-02-01,Coffee Shop,4.50\n2026-02-20,Grocery,62.10\n';
    const file = new File([csv], 'stmt.csv', { type: 'text/csv' });

    const range = await service.detectCsvDateRange(file);

    expect(range).toEqual({ openingDate: '2026-02-01', closingDate: '2026-02-20' });
  });

  it('returns null for a CSV with no plausible date column', async () => {
    const csv = 'merchant,amount\nCoffee Shop,4.50\nGrocery,62.10\n';
    const file = new File([csv], 'stmt.csv', { type: 'text/csv' });

    expect(await service.detectCsvDateRange(file)).toBeNull();
  });
});

// REQ-STMT-09
describe('CSV date-range detection helpers', () => {
  it('parseCsvRows splits quoted fields containing commas', () => {
    const rows = parseCsvRows('date,merchant,amount\n01/01/2026,"Store, Inc.",10.00');
    expect(rows).toEqual([
      ['date', 'merchant', 'amount'],
      ['01/01/2026', 'Store, Inc.', '10.00'],
    ]);
  });

  it('parseFlexibleDate accepts MM/DD/YYYY and ISO, rejects garbage', () => {
    expect(parseFlexibleDate('01/15/2026')?.toISOString().slice(0, 10)).toBe('2026-01-15');
    expect(parseFlexibleDate('2026-01-15')?.toISOString().slice(0, 10)).toBe('2026-01-15');
    expect(parseFlexibleDate('13/45/2026')).toBeNull();
    expect(parseFlexibleDate('not a date')).toBeNull();
    expect(parseFlexibleDate('')).toBeNull();
  });

  it('findDateColumnIndex prefers an exact "date" header over density', () => {
    const header = ['id', 'date', 'amount'];
    const rows = [
      ['1', '01/01/2026', '10.00'],
      ['2', '01/02/2026', '20.00'],
    ];
    expect(findDateColumnIndex(header, rows)).toBe(1);
  });

  it('findDateColumnIndex returns -1 when no column is mostly parseable dates', () => {
    const header = ['merchant', 'amount'];
    const rows = [
      ['Coffee Shop', '4.50'],
      ['Grocery', '62.10'],
    ];
    expect(findDateColumnIndex(header, rows)).toBe(-1);
  });
});
