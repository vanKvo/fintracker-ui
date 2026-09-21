import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AccountService, Account } from '../../../core/services/account.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  StatementService,
  SourceFormat,
  JobStatusResponse,
  DuplicateInfo,
  InitiateUploadRequest,
} from '../../../core/services/statement.service';
import { BANK_INSTITUTIONS, BankInstitution } from '../../../core/constants/bank-institutions';
import {
  MappingConfirmationDialog,
  MappingConfirmationDialogData,
} from '../mapping-confirmation-dialog/mapping-confirmation-dialog';
import {
  DuplicateStatementDialog,
  DuplicateStatementDialogData,
  DuplicateResolution,
} from '../duplicate-statement-dialog/duplicate-statement-dialog';

type UploadStage = 'form' | 'uploading' | 'processing' | 'done' | 'error';

export interface UploadStatementResult {
  statementId: string;
  finalStatus: string;
}

@Component({
  selector: 'app-upload-statement-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule,
  ],
  templateUrl: './upload-statement-modal.html',
  styleUrl: './upload-statement-modal.scss',
})
export class UploadStatementModal implements OnDestroy {
  private dialogRef = inject(MatDialogRef<UploadStatementModal, UploadStatementResult | undefined>);
  private accountService = inject(AccountService);
  private statementService = inject(StatementService);
  private authService = inject(AuthService);
  private matDialog = inject(MatDialog);

  readonly banks: BankInstitution[] = BANK_INSTITUTIONS;

  accounts = signal<Account[]>([]);
  sourceFormat = signal<SourceFormat | ''>('');
  selectedAccountId = signal('');
  selectedBankId = signal('');
  openingDate = signal('');
  closingDate = signal('');
  description = signal('');
  selectedFile = signal<File | null>(null);

  stage = signal<UploadStage>('form');
  statusMessage = signal('');
  errorMessage = signal('');
  /** Set when a duplicate was detected, so the panel can name the statement it matched. */
  duplicate = signal<DuplicateInfo | null>(null);
  private jobId: string | null = null;
  private pollSubscription?: Subscription;

  // REQ-DP-01 "Screenshot Stricter Gate" starts here in the UI too: a
  // screenshot is functionally an image upload with no CSV mapping and no
  // multi-page context, so it reuses the IMAGE format under the hood.
  readonly documentTypeOptions: { value: SourceFormat; label: string }[] = [
    { value: 'CSV', label: 'CSV Export' },
    { value: 'PDF', label: 'PDF Statement' },
    { value: 'IMAGE', label: 'Screenshot' },
  ];

  readonly isCsv = computed(() => this.sourceFormat() === 'CSV');

  readonly acceptTypes = computed(() => {
    switch (this.sourceFormat()) {
      case 'CSV':
        return '.csv';
      case 'PDF':
        return '.pdf';
      case 'IMAGE':
        return '.png,.jpg,.jpeg';
      default:
        return '';
    }
  });

  // REQ-STMT-07: the date range is required for every format, CSV included. The server derives
  // the statement's month from closingDate, so there is nothing else to collect.
  readonly canSubmit = computed(() => {
    if (!this.sourceFormat() || !this.selectedAccountId() || !this.selectedFile()) {
      return false;
    }
    if (this.isCsv() && !this.selectedBankId()) {
      return false;
    }
    if (!this.openingDate() || !this.closingDate()) {
      return false;
    }
    // Checked here as well as server-side so the user sees it before uploading anything.
    return !this.dateRangeInvalid();
  });

  readonly dateRangeInvalid = computed(() => {
    const opening = this.openingDate();
    const closing = this.closingDate();
    return !!opening && !!closing && closing < opening;
  });

  constructor() {
    this.accountService.getAccounts().subscribe((accounts) => this.accounts.set(accounts));
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  onDocumentTypeChange(value: SourceFormat): void {
    this.sourceFormat.set(value);
    // Fields not applicable to the newly selected format are cleared, not
    // just hidden — REQ-DP-01 B. Constraints: bankId must be omitted
    // entirely (not just blank) for a non-CSV upload.
    if (value !== 'CSV') {
      this.selectedBankId.set('');
    }
    // The date range applies to every format now (REQ-STMT-07), so it survives a format change.
    this.selectedFile.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.selectedFile.set(file);

    // REQ-STMT-09: pre-fill the date range from the file itself instead of leaving it to the
    // user to type — fields stay editable, and a failed/ambiguous detection just leaves them
    // as they were rather than blocking the upload.
    if (this.isCsv()) {
      this.statementService.detectCsvDateRange(file).then((range) => {
        // The file can change again before this resolves; a stale result for a since-replaced
        // file must never overwrite whatever applies to the current selection.
        if (!range || this.selectedFile() !== file) {
          return;
        }
        this.openingDate.set(range.openingDate);
        this.closingDate.set(range.closingDate);
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  upload(): Promise<void> {
    return this.runUpload();
  }

  /**
   * REQ-STMT-03/05/07. One method serves both the first attempt and the re-submission after the
   * user chooses to overwrite, because the spec defines exactly one overwrite mechanism: the same
   * initiate-upload request with overwriteStatementId set. Nothing else differs between them.
   */
  private async runUpload(overwriteStatementId?: string): Promise<void> {
    const file = this.selectedFile();
    const format = this.sourceFormat();
    if (!file || !format || !this.canSubmit()) {
      return;
    }

    this.stage.set('uploading');
    this.errorMessage.set('');
    this.duplicate.set(null);

    try {
      const userId = await this.authService.getCurrentUserId();

      // REQ-STMT-03: hashed before anything is sent, so an exact re-upload is recognized without
      // the file leaving the browser at all.
      this.statusMessage.set('Checking file…');
      const contentHash = await this.statementService.computeContentHash(file);

      const request: InitiateUploadRequest = {
        accountId: this.selectedAccountId(),
        description: this.description() || undefined,
        sourceFormat: format,
        fileName: file.name,
        bankId: this.isCsv() ? this.selectedBankId() : undefined,
        openingDate: this.openingDate(),
        closingDate: this.closingDate(),
        contentHash,
        overwriteStatementId,
      };

      this.statusMessage.set('Uploading file…');
      const initiateResponse = await this.statementService.initiateUpload(request).toPromise();
      if (!initiateResponse) {
        throw new Error('No response from server');
      }
      this.jobId = initiateResponse.jobId;

      await this.statementService
        .uploadToS3(initiateResponse.uploadUrl, file, {
          userId,
          statementId: initiateResponse.jobId,
          accountId: this.selectedAccountId(),
          bankId: this.isCsv() ? this.selectedBankId() : undefined,
        })
        .toPromise();

      this.stage.set('processing');
      this.statusMessage.set('Processing statement…');
      this.startPolling(initiateResponse.jobId);
    } catch (err: any) {
      // REQ-STMT-03/06: a duplicate is a 409 carrying the existing statement's details, not a
      // generic failure — it gets the prompt, not the error panel.
      const duplicate = this.asDuplicate(err);
      if (duplicate) {
        this.promptForDuplicate(duplicate, false);
        return;
      }
      // Full detail (including a raw HttpErrorResponse.message for non-backend failures, e.g.
      // the direct-to-S3 PUT) is developer-facing only — never shown to the user, since it can
      // include internal hostnames/ports/infra details. err?.error?.detail is the one exception:
      // it's a message our own backend already crafted to be user-safe (RFC 9457 problem detail).
      console.error('Statement upload failed', err);
      this.stage.set('error');
      this.errorMessage.set(err?.error?.detail || 'Upload failed. Please try again.');
    }
  }

  /**
   * Reads the duplicate payload out of a 409 problem-detail response. Returns null for anything
   * else, so an unrelated error still reaches the normal error path rather than being mistaken
   * for a duplicate.
   */
  private asDuplicate(err: any): DuplicateInfo | null {
    const body = err?.error;
    if (err?.status !== 409 || !body?.matchType || !body?.existingStatementId) {
      return null;
    }
    return {
      matchType: body.matchType,
      existingStatementId: body.existingStatementId,
      existingUploadDate: body.existingUploadDate,
      existingTransactionCount: body.existingTransactionCount ?? 0,
    };
  }

  /**
   * REQ-STMT-05: the same prompt for both timings. On overwrite the upload is re-submitted naming
   * the statement to replace; on cancel nothing is changed.
   */
  private promptForDuplicate(duplicate: DuplicateInfo, midProcessing: boolean): void {
    this.stage.set('form');
    this.duplicate.set(duplicate);

    const ref = this.matDialog.open<
      DuplicateStatementDialog,
      DuplicateStatementDialogData,
      DuplicateResolution | undefined
    >(DuplicateStatementDialog, { data: { duplicate, midProcessing }, disableClose: true });

    ref.afterClosed().subscribe(async (resolution) => {
      // A dismissed dialog is a cancel: destroying an existing statement is never the default.
      if (resolution !== 'overwrite') {
        this.duplicate.set(null);
        this.statusMessage.set('');
        // REQ-STMT-05: the half-finished import must not be left behind as an empty,
        // failed-looking entry in the user's statement list.
        await this.discardAbandonedJob(midProcessing);
        return;
      }

      await this.discardAbandonedJob(midProcessing);
      await this.runUpload(duplicate.existingStatementId);
    });
  }

  /**
   * REQ-STMT-05: cleans up the tracking record the mid-processing path already created before the
   * duplicate was discovered. Only the mid-processing case has one — an up-front duplicate is
   * rejected before any statement row exists.
   *
   * A failure here is deliberately not surfaced: the user's decision has already been taken, and
   * a leftover row is a tidiness problem, not something they can act on.
   */
  private async discardAbandonedJob(midProcessing: boolean): Promise<void> {
    if (!midProcessing || !this.jobId) {
      return;
    }
    const abandonedJobId = this.jobId;
    this.jobId = null;
    try {
      await this.statementService.deleteStatement(abandonedJobId).toPromise();
    } catch {
      // Intentionally ignored — see method comment.
    }
  }

  private startPolling(jobId: string): void {
    this.pollSubscription = this.statementService.pollJobStatus(jobId).subscribe({
      next: (res) => this.handleStatusUpdate(res),
      error: () => {
        this.stage.set('error');
        this.errorMessage.set('Lost connection while checking upload status. It may still complete — check the statements list shortly.');
      },
    });
  }

  private handleStatusUpdate(res: JobStatusResponse): void {
    this.statusMessage.set(this.describeStatus(res.status));

    if (res.status === 'PENDING_MAPPING_CONFIRMATION' && res.mappingProposal) {
      this.pollSubscription?.unsubscribe();
      this.openMappingConfirmation(res.mappingProposal, this.jobId!);
      return;
    }

    // REQ-STMT-04: a likely duplicate found after the file was read. Same prompt as the up-front
    // case; the difference is that an overwrite here restarts the upload rather than continuing.
    if (res.status === 'PENDING_DUPLICATE_RESOLUTION' && res.duplicate) {
      this.pollSubscription?.unsubscribe();
      this.promptForDuplicate(res.duplicate, true);
      return;
    }

    if (res.status === 'FAILED') {
      this.stage.set('error');
      // REQ-STMT-08: the server-side recheck found a duplicate the up-front check missed. It is a
      // named reason, so the user gets the same explanation as every other duplicate rather than
      // an unexplained failure. Not offered as overwrite-or-cancel — the spec defers that.
      if (res.errorCode === 'SERVER_DUPLICATE_DETECTED' && res.duplicate) {
        this.duplicate.set(res.duplicate);
        this.errorMessage.set(
          'This file turned out to duplicate a statement already on this account. '
          + 'It was not imported. Delete the existing statement first if you meant to replace it.'
        );
        return;
      }
      this.errorMessage.set(res.error || 'Statement processing failed.');
      return;
    }

    if (res.status === 'COMPLETED' || res.status === 'PARTIALLY_COMPLETED') {
      this.stage.set('done');
      this.statusMessage.set(
        res.status === 'PARTIALLY_COMPLETED'
          ? 'Statement imported with some transactions needing attention.'
          : 'Statement imported successfully.'
      );
      setTimeout(() => this.dialogRef.close({ statementId: this.jobId!, finalStatus: res.status }), 1200);
    }
  }

  private openMappingConfirmation(proposal: JobStatusResponse['mappingProposal'], jobId: string): void {
    if (!proposal) return;

    const ref = this.matDialog.open<MappingConfirmationDialog, MappingConfirmationDialogData, Record<string, string> | undefined>(
      MappingConfirmationDialog,
      { data: { proposal }, disableClose: true }
    );

    ref.afterClosed().subscribe((confirmedMapping) => {
      if (!confirmedMapping) {
        // User cancelled the mapping dialog — the Step Functions execution
        // stays paused server-side until it hits its own timeout; nothing
        // more to do here except let the user know.
        this.stage.set('error');
        this.errorMessage.set('Column mapping was not confirmed. The statement was not imported.');
        return;
      }

      this.statusMessage.set('Confirming column mapping…');
      this.statementService.confirmMapping(jobId, proposal.bankId, confirmedMapping).subscribe({
        next: () => this.startPolling(jobId),
        error: (err) => {
          this.stage.set('error');
          this.errorMessage.set(err?.error?.detail || 'Failed to confirm column mapping.');
        },
      });
    });
  }

  private describeStatus(status: JobStatusResponse['status']): string {
    switch (status) {
      case 'STARTED':
        return 'Starting…';
      case 'GATEKEEPER_PASSED':
        return 'Reading statement…';
      case 'INGESTING':
        return 'Extracting transactions…';
      case 'NORMALIZING':
        return 'Categorizing transactions…';
      case 'PENDING_DUPLICATE_RESOLUTION':
        return 'Checking for a duplicate…';
      default:
        return 'Processing statement…';
    }
  }
}
