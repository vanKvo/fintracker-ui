import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { StatementService } from './statement.service';

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
});
