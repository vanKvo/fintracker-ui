import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, combineLatest, timer } from 'rxjs';
import { map, switchMap, takeWhile, take } from 'rxjs/operators';
import { AccountService } from './account.service';

export type SourceFormat = 'CSV' | 'PDF' | 'IMAGE';

export interface InitiateUploadRequest {
  accountId: string;
  description?: string;
  sourceFormat: SourceFormat;
  fileName: string;
  bankId?: string; // required for CSV, omitted otherwise
  // REQ-STMT-07: collected for every format now, not just PDF/IMAGE. The server derives the
  // statement's grouping month from closingDate, so there is no statementMonth field any more.
  openingDate: string; // YYYY-MM-DD
  closingDate: string; // YYYY-MM-DD
  // REQ-STMT-03: SHA-256 of the file's exact bytes, computed before upload. Required — an upload
  // without one is rejected, so no client can opt itself out of duplicate detection.
  contentHash: string;
  // REQ-STMT-05: set when the user answered "overwrite" on a duplicate prompt. The same field
  // serves both the up-front duplicate and the one found mid-processing.
  overwriteStatementId?: string;
}

/** REQ-STMT: 202 Accepted — the upload is accepted for background work, not completed. */
export interface InitiateUploadResponse {
  jobId: string; // === statementId; the handle for polling everything below
  status: string; // always 'PROCESSING' at this point
  uploadUrl: string; // presigned S3 PUT
  s3ObjectKey: string;
}

export type DuplicateMatchType = 'EXACT_FILE' | 'CONTENT_FINGERPRINT' | 'SAME_MONTH';

/**
 * The "statement already exists" payload. Deliberately one shape for all three paths that can
 * produce it — the 409 problem-detail at upload time (REQ-STMT-03/06), the mid-processing pause
 * (REQ-STMT-04) and the server-side recheck failure (REQ-STMT-08) — so the UI renders one panel
 * regardless of which one fired.
 */
export interface DuplicateInfo {
  matchType: DuplicateMatchType;
  existingStatementId: string;
  existingUploadDate: string;
  existingTransactionCount: number;
}

export type PipelineJobStatus =
  | 'STARTED'
  | 'PROCESSING'
  | 'PENDING_CSV_COL_MAPPING_CONFIRMATION'
  // REQ-STMT-04: a likely duplicate was found after the file was read. Waits on the user, like
  // the mapping pause above — not a failure.
  | 'PENDING_DUPLICATE_RESOLUTION'
  | 'GATEKEEPER_PASSED'
  | 'INGESTING'
  | 'NORMALIZING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED';

/** REQ-STMT-08: the named reason a background check ended the import. */
export type JobErrorCode = 'SERVER_DUPLICATE_DETECTED';

export interface ColumnMappingProposal {
  bankId: string;
  csvS3Key: string;
  mapped: Record<string, string>; // canonical field -> matched source column
  unmappedColumns: string[];
  isKnownBank: boolean;
}

export interface JobStatusResponse {
  jobId: string;
  status: PipelineJobStatus;
  error: string | null;
  mappingProposal?: ColumnMappingProposal;
  /** Present only when status is FAILED. */
  errorCode?: JobErrorCode;
  /** Present for PENDING_DUPLICATE_RESOLUTION, and for FAILED/SERVER_DUPLICATE_DETECTED. */
  duplicate?: DuplicateInfo;
}

/**
 * REQ-STMT-09 helpers — pure functions so the date-detection heuristic is testable without a
 * DOM/File object. Deliberately not a full RFC 4180 parser: just enough to split a bank-export
 * CSV's cells (including simple quoted fields) for column-scanning purposes. A malformed row
 * degrades to a bad guess for that row, never a thrown error.
 */
export function parseCsvRows(text: string): string[][] {
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    });
}

/** Accepts common bank-export date formats; returns null rather than an Invalid Date. */
export function parseFlexibleDate(raw: string): Date | null {
  const value = (raw || '').trim();
  if (!value) return null;

  // MM/DD/YYYY, M-D-YY, etc. — the formats a native `new Date(string)` parse is unreliable for
  // (that constructor is documented as implementation-defined for anything but ISO 8601).
  const slashOrDash = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashOrDash) {
    const [, month, day, yearRaw] = slashOrDash;
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    const date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
    const valid = date.getUTCFullYear() === year && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
    return valid ? date : null;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** FileReader, not file.text()/arrayBuffer() — broader support across browsers/test runtimes. */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
// REQ-STMT-09: Auto-detects the CSV date column for form pre-filling.
// Matches backend logic (gatekeeper/service.py): trusts a header named "date" 
// outright; otherwise selects the column with the highest frequency of valid date values.
 */
export function findDateColumnIndex(header: string[], dataRows: string[][]): number {
  const exactIndex = header.findIndex((h) => h.trim().toLowerCase() === 'date');
  if (exactIndex !== -1) return exactIndex;

  let bestIndex = -1;
  let bestDensity = 0;
  for (let col = 0; col < header.length; col++) {
    const values = dataRows.map((row) => row[col]).filter((v) => v);
    if (!values.length) continue;
    const parsedCount = values.filter((v) => parseFlexibleDate(v) !== null).length;
    const density = parsedCount / values.length;
    if (density > bestDensity) {
      bestDensity = density;
      bestIndex = col;
    }
  }
  // A column that mostly fails to parse as a date is more likely amount/merchant than a date
  // column with unusual formatting — better to leave the fields blank than guess wrong.
  return bestDensity >= 0.5 ? bestIndex : -1;
}

const TERMINAL_STATUSES: PipelineJobStatus[] = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'];

/** Non-terminal statuses that stop the poller because they need an answer from the user. */
const WAITING_STATUSES: PipelineJobStatus[] = [
  'PENDING_CSV_COL_MAPPING_CONFIRMATION',
  'PENDING_DUPLICATE_RESOLUTION',
];

@Injectable({
  providedIn: 'root'
})
export class StatementService {
  private apiUrl = '/api/v1/ledger/statements';
  private pipelineApiUrl = '/api/v1/pipeline';

  constructor(private http: HttpClient, private accountService: AccountService) {}

  getStatements(): Observable<any[]> {
    return combineLatest([
      this.http.get<any[]>(this.apiUrl),
      this.accountService.getAccounts()
    ]).pipe(
      map(([statements, accounts]) => {
        const accountMap = new Map(accounts.map(a => [a.accountId, a.accountName]));

        return statements.map(s => ({
          id: s.statementId,
          period: s.statementMonth,
          openingDate: s.openingDate,
          closingDate: s.closingDate,
          description: s.description || '',
          account: accountMap.get(s.accountId) || 'Unknown Account',
          transactions: s.txCount,
          pending: s.pendingCount,
          approved: s.approvedCount,
          status: s.status === 'PROCESSING' ? 'Processing' : (s.status === 'NEEDS_ATTENTION' ? 'Needs Attention' : (s.status === 'COMPLETED' ? 'Completed' : 'Failed'))
        }));
      })
    );
  }

  deleteStatement(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  /** Step 1: create the statement record and get a presigned S3 upload URL. */
  initiateUpload(request: InitiateUploadRequest): Observable<InitiateUploadResponse> {
    return this.http.post<InitiateUploadResponse>(`${this.apiUrl}/initiate-upload`, request);
  }

  /**
   * Step 2: PUT the file directly to S3. The x-amz-meta-* headers here MUST
   * match exactly what the Ledger's S3PresignService baked into the
   * presigned URL's signature (user-id/statement-id/account-id/bank-id) —
   * S3 rejects the upload with a signature mismatch otherwise. This
   * request intentionally bypasses the auth interceptor (it only attaches
   * to URLs containing "/api/", and a presigned S3 URL never does) so no
   * Cognito/internal-user header gets sent to S3, which would also break
   * the signature.
   */
  uploadToS3(
    presignedUrl: string,
    file: File,
    metadata: { userId: string; statementId: string; accountId: string; bankId?: string }
  ): Observable<any> {
    let headers = new HttpHeaders({
      'Content-Type': file.type || 'application/octet-stream',
      'x-amz-meta-user-id': metadata.userId,
      'x-amz-meta-statement-id': metadata.statementId,
      'x-amz-meta-account-id': metadata.accountId
    });
    if (metadata.bankId) {
      headers = headers.set('x-amz-meta-bank-id', metadata.bankId);
    }
    return this.http.put(presignedUrl, file, { headers });
  }

  /** Step 3: current pipeline status for a job (job_id === statementId). */
  getJobStatus(jobId: string): Observable<JobStatusResponse> {
    return this.http.get<JobStatusResponse>(`${this.pipelineApiUrl}/jobs/${jobId}`);
  }

  /**
   * Polls job status every `intervalMs` until it reaches something the caller must act on: a
   * terminal status, or one of the two pauses that wait on a user decision.
   *
   * Every waiting status MUST appear in WAITING_STATUSES. One that is missing does not fail
   * loudly — the poller simply keeps spinning until its 1000-tick ceiling and the user is never
   * prompted, which looks like a hung upload rather than a bug.
   */
  pollJobStatus(jobId: string, intervalMs = 3000): Observable<JobStatusResponse> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getJobStatus(jobId)),
      take(1000), // hard ceiling so a stuck job can't poll forever if the UI is left open
      // Emit every status until we hit one the caller should stop and act on.
      // `takeWhile` with inclusive=true keeps the stopping value in the stream.
      takeWhile(
        (res) => !WAITING_STATUSES.includes(res.status) && !TERMINAL_STATUSES.includes(res.status),
        true
      )
    );
  }

  /**
   * REQ-STMT-03: SHA-256 of the file's exact bytes, hex-encoded, computed in the browser before
   * the upload is initiated so the server can recognize a re-upload without the file moving at all.
   *
   * The server independently recomputes this once the file lands and trusts its own value if the
   * two disagree (REQ-STMT-08), so this is an optimization for the common case, not a trusted
   * input. crypto.subtle is only available over HTTPS or on localhost.
   */
  async computeContentHash(file: File): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * REQ-STMT-09: best-effort detection of a CSV's statement date range, to pre-fill the
   * openingDate/closingDate fields instead of requiring the user to type them. Returns null
   * (rather than throwing) whenever the file doesn't look parseable — the caller leaves the
   * date fields for the user to fill in manually, exactly as before this existed.
   */
  async detectCsvDateRange(file: File): Promise<{ openingDate: string; closingDate: string } | null> {
    const text = await readFileAsText(file);
    const rows = parseCsvRows(text);
    if (rows.length < 2) return null;

    const [header, ...dataRows] = rows;
    const columnIndex = findDateColumnIndex(header, dataRows);
    if (columnIndex === -1) return null;

    const parsedDates = dataRows
      .map((row) => parseFlexibleDate(row[columnIndex]))
      .filter((d): d is Date => d !== null);
    if (!parsedDates.length) return null;

    const times = parsedDates.map((d) => d.getTime());
    return {
      openingDate: toIsoDate(new Date(Math.min(...times))),
      closingDate: toIsoDate(new Date(Math.max(...times))),
    };
  }

  /** Step 4 (CSV only): submit the user-confirmed column mapping. */
  confirmCsvColMapping(jobId: string, bankId: string, confirmedMapping: Record<string, string>): Observable<void> {
    return this.http.post<void>(`${this.pipelineApiUrl}/jobs/${jobId}/csv-col-mapping-confirmation`, {
      bank_id: bankId,
      confirmed_mapping: confirmedMapping
    });
  }
}
