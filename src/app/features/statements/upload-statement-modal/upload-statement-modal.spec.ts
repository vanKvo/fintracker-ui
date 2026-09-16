import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { UploadStatementModal } from './upload-statement-modal';
import { AccountService } from '../../../core/services/account.service';
import { StatementService } from '../../../core/services/statement.service';
import { AuthService } from '../../../core/services/auth.service';

describe('UploadStatementModal', () => {
  /** The 409 problem-detail body the Ledger returns for a duplicate (REQ-STMT-03/06). */
  const duplicate409 = {
    status: 409,
    error: {
      matchType: 'EXACT_FILE',
      existingStatementId: 'old-stmt',
      existingUploadDate: '2026-08-27T10:15:00Z',
      existingTransactionCount: 34,
    },
  };

  function createComponent(overrides: {
    statementService?: Partial<StatementService>;
    dialogResult?: 'overwrite' | 'cancel' | undefined;
  } = {}) {
    const dialogOpens: any[] = [];
    TestBed.configureTestingModule({
      imports: [UploadStatementModal],
      providers: [
        { provide: MatDialogRef, useValue: { close: () => {} } },
        {
          provide: AccountService,
          useValue: { getAccounts: () => of([{ accountId: 'acc-1', accountName: 'Chase Checking' } as any]) },
        },
        {
          provide: StatementService,
          useValue: {
            computeContentHash: () => Promise.resolve('a'.repeat(64)),
            initiateUpload: () => of({ jobId: 'stmt-1', status: 'PROCESSING', uploadUrl: 'https://s3/x', s3ObjectKey: 'k' }),
            uploadToS3: () => of(null),
            pollJobStatus: () => of({ jobId: 'stmt-1', status: 'PROCESSING', error: null }),
            deleteStatement: () => of(null),
            ...overrides.statementService,
          },
        },
        { provide: AuthService, useValue: { getCurrentUserId: () => Promise.resolve('user-1') } },
      ],
    });
    // MatDialogModule is imported by the standalone component itself, so its MatDialog provider
    // wins over one merely listed above — it has to be overridden explicitly.
    TestBed.overrideProvider(MatDialog, {
      useValue: {
        open: (_cmp: any, config: any) => {
          dialogOpens.push(config?.data);
          return { afterClosed: () => of(overrides.dialogResult) };
        },
      },
    });
    const fixture = TestBed.createComponent(UploadStatementModal);
    fixture.detectChanges();
    return { component: fixture.componentInstance, dialogOpens };
  }

  /** The dialog callback awaits cleanup before re-submitting; drain the queue rather than guess. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** A form filled in well enough to submit, so each test only varies the one thing it is about. */
  function fillValidCsvForm(component: UploadStatementModal) {
    component.onDocumentTypeChange('CSV');
    component.selectedAccountId.set('acc-1');
    component.selectedBankId.set('chase');
    component.openingDate.set('2026-04-01');
    component.closingDate.set('2026-04-30');
    component.selectedFile.set(new File(['x'], 'stmt.csv'));
  }

  it('loads the real account list instead of a hardcoded one', () => {
    const { component } = createComponent();
    expect(component.accounts()).toEqual([{ accountId: 'acc-1', accountName: 'Chase Checking' }]);
  });

  it('CSV requires a bank selection before submission is allowed', () => {
    const { component } = createComponent();
    component.onDocumentTypeChange('CSV');
    component.selectedAccountId.set('acc-1');
    component.openingDate.set('2026-04-01');
    component.closingDate.set('2026-04-30');
    component.selectedFile.set(new File(['x'], 'stmt.csv'));

    expect(component.canSubmit()).toBe(false);
    component.selectedBankId.set('chase');
    expect(component.canSubmit()).toBe(true);
  });

  // REQ-STMT-07: the date range used to be PDF/IMAGE-only, with CSV asking for a month instead.
  it('REQ-STMT-07: CSV now requires the opening/closing range too, not a statement month', () => {
    const { component } = createComponent();
    component.onDocumentTypeChange('CSV');
    component.selectedAccountId.set('acc-1');
    component.selectedBankId.set('chase');
    component.selectedFile.set(new File(['x'], 'stmt.csv'));

    expect(component.canSubmit()).toBe(false);
    component.openingDate.set('2026-04-01');
    component.closingDate.set('2026-04-30');
    expect(component.canSubmit()).toBe(true);
  });

  it('REQ-STMT-07: a closing date before the opening date blocks submission before anything uploads', () => {
    const { component } = createComponent();
    fillValidCsvForm(component);
    component.closingDate.set('2026-03-01');

    expect(component.dateRangeInvalid()).toBe(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('REQ-STMT-07: a single-day statement is allowed — only "before" is invalid, not "equal"', () => {
    const { component } = createComponent();
    fillValidCsvForm(component);
    component.closingDate.set('2026-04-01');

    expect(component.dateRangeInvalid()).toBe(false);
    expect(component.canSubmit()).toBe(true);
  });

  it('REQ-STMT-07: the date range survives a document-type change, since every format needs it', () => {
    const { component } = createComponent();
    component.onDocumentTypeChange('PDF');
    component.openingDate.set('2026-04-01');
    component.closingDate.set('2026-04-30');

    component.onDocumentTypeChange('CSV');
    expect(component.openingDate()).toBe('2026-04-01');
    expect(component.closingDate()).toBe('2026-04-30');
  });

  it('switching document type still clears the bank, which only applies to CSV', () => {
    const { component } = createComponent();
    component.onDocumentTypeChange('CSV');
    component.selectedBankId.set('chase');
    component.onDocumentTypeChange('PDF');
    expect(component.selectedBankId()).toBe('');
  });

  it('REQ-STMT-03: the file is hashed and the hash is sent with the upload request', async () => {
    const requests: any[] = [];
    const { component } = createComponent({
      statementService: {
        initiateUpload: ((req: any) => {
          requests.push(req);
          return of({ jobId: 'stmt-1', status: 'PROCESSING', uploadUrl: 'https://s3/x', s3ObjectKey: 'k' });
        }) as any,
      },
    });
    fillValidCsvForm(component);

    await component.upload();

    expect(requests[0].contentHash).toBe('a'.repeat(64));
    // The month field is gone; the server derives it from closingDate.
    expect(requests[0].statementMonth).toBeUndefined();
    expect(requests[0].openingDate).toBe('2026-04-01');
  });

  // REQ-STMT-03/05: a duplicate is a prompt, not a failure. Landing in the error panel would
  // strand the user with no way to act on it.
  it('REQ-STMT-05: a 409 duplicate opens the prompt instead of showing an error', async () => {
    const { component, dialogOpens } = createComponent({
      dialogResult: 'cancel',
      statementService: { initiateUpload: (() => throwError(() => duplicate409)) as any },
    });
    fillValidCsvForm(component);

    await component.upload();

    expect(dialogOpens.length).toBe(1);
    expect(dialogOpens[0].duplicate.existingStatementId).toBe('old-stmt');
    expect(dialogOpens[0].midProcessing).toBe(false);
    expect(component.stage()).not.toBe('error');
  });

  it('REQ-STMT-05: choosing Overwrite re-submits the same upload naming the statement to replace', async () => {
    const requests: any[] = [];
    let call = 0;
    const { component } = createComponent({
      dialogResult: 'overwrite',
      statementService: {
        initiateUpload: ((req: any) => {
          requests.push(req);
          // Only the first attempt is a duplicate; the re-submission must succeed.
          return call++ === 0
            ? throwError(() => duplicate409)
            : of({ jobId: 'stmt-2', status: 'PROCESSING', uploadUrl: 'https://s3/x', s3ObjectKey: 'k' });
        }) as any,
      },
    });
    fillValidCsvForm(component);

    await component.upload();
    await settle();

    expect(requests.length).toBe(2);
    expect(requests[0].overwriteStatementId).toBeUndefined();
    expect(requests[1].overwriteStatementId).toBe('old-stmt');
  });

  it('REQ-STMT-05: choosing Cancel changes nothing — no second upload is attempted', async () => {
    const requests: any[] = [];
    const { component } = createComponent({
      dialogResult: 'cancel',
      statementService: {
        initiateUpload: ((req: any) => {
          requests.push(req);
          return throwError(() => duplicate409);
        }) as any,
      },
    });
    fillValidCsvForm(component);

    await component.upload();
    await settle();

    expect(requests.length).toBe(1);
  });

  // Dismissing the dialog without answering must not be treated as consent to destroy data.
  it('REQ-STMT-05: dismissing the prompt is treated as Cancel, not Overwrite', async () => {
    const requests: any[] = [];
    const { component } = createComponent({
      dialogResult: undefined,
      statementService: {
        initiateUpload: ((req: any) => {
          requests.push(req);
          return throwError(() => duplicate409);
        }) as any,
      },
    });
    fillValidCsvForm(component);

    await component.upload();
    await settle();

    expect(requests.length).toBe(1);
  });

  it('a non-duplicate failure still reaches the error panel rather than the duplicate prompt', async () => {
    const { component, dialogOpens } = createComponent({
      statementService: {
        initiateUpload: (() => throwError(() => ({ status: 500, error: { detail: 'Server exploded' } }))) as any,
      },
    });
    fillValidCsvForm(component);

    await component.upload();

    expect(dialogOpens.length).toBe(0);
    expect(component.stage()).toBe('error');
    expect(component.errorMessage()).toBe('Server exploded');
  });

  // REQ-STMT-04: found after the file was read, so the abandoned tracking record must be cleaned
  // up rather than left as an empty, failed-looking entry in the statement list.
  it('REQ-STMT-04: a mid-processing duplicate prompts and discards the abandoned job', async () => {
    const deleted: string[] = [];
    const { component, dialogOpens } = createComponent({
      dialogResult: 'cancel',
      statementService: {
        pollJobStatus: (() =>
          of({
            jobId: 'stmt-1',
            status: 'PENDING_DUPLICATE_RESOLUTION',
            error: null,
            duplicate: {
              matchType: 'CONTENT_FINGERPRINT',
              existingStatementId: 'old-stmt',
              existingUploadDate: '2026-08-27T10:15:00Z',
              existingTransactionCount: 34,
            },
          })) as any,
        deleteStatement: ((id: string) => {
          deleted.push(id);
          return of(null);
        }) as any,
      },
    });
    fillValidCsvForm(component);

    await component.upload();
    await settle();

    expect(dialogOpens.length).toBe(1);
    expect(dialogOpens[0].midProcessing).toBe(true);
    expect(deleted).toEqual(['stmt-1']);
  });

  // REQ-STMT-08: the background recheck caught what the up-front check missed. The user must be
  // told which statement it matched, not just that something failed.
  it('REQ-STMT-08: a SERVER_DUPLICATE_DETECTED failure names the existing statement', async () => {
    const { component } = createComponent({
      statementService: {
        pollJobStatus: (() =>
          of({
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
          })) as any,
      },
    });
    fillValidCsvForm(component);

    await component.upload();

    expect(component.stage()).toBe('error');
    expect(component.duplicate()?.existingTransactionCount).toBe(12);
    expect(component.errorMessage()).toContain('duplicate');
  });

  it('the accept attribute matches the selected document type', () => {
    const { component } = createComponent();
    component.onDocumentTypeChange('CSV');
    expect(component.acceptTypes()).toBe('.csv');
    component.onDocumentTypeChange('IMAGE');
    expect(component.acceptTypes()).toBe('.png,.jpg,.jpeg');
  });
});
