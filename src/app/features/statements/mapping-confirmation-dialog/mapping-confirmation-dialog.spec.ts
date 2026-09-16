import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MappingConfirmationDialog, MappingConfirmationDialogData } from './mapping-confirmation-dialog';

describe('MappingConfirmationDialog', () => {
  function createComponent(data: MappingConfirmationDialogData, dialogRefSpy: { close: (r?: any) => void }) {
    TestBed.configureTestingModule({
      imports: [MappingConfirmationDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    });
    const fixture = TestBed.createComponent(MappingConfirmationDialog);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('pre-selects the backend-proposed mapping as the default selection', () => {
    const component = createComponent(
      {
        proposal: {
          bankId: 'chase',
          csvS3Key: 'stmt.csv',
          mapped: { date: 'Posting Date', merchant: 'Description', amount: 'Amount' },
          unmappedColumns: ['Balance'],
          isKnownBank: true,
        },
      },
      { close: () => {} }
    );

    expect(component.selections()).toEqual({ date: 'Posting Date', merchant: 'Description', amount: 'Amount' });
    expect(component.canConfirm()).toBe(true);
  });

  it('canConfirm is false until every required field has a selection (unknown bank, nothing auto-matched)', () => {
    const component = createComponent(
      {
        proposal: {
          bankId: 'unknown_bank',
          csvS3Key: 'stmt.csv',
          mapped: {},
          unmappedColumns: ['Transaction Date', 'Description', 'Debit'],
          isKnownBank: false,
        },
      },
      { close: () => {} }
    );

    expect(component.canConfirm()).toBe(false);

    component.setSelection('date', 'Transaction Date');
    component.setSelection('merchant', 'Description');
    expect(component.canConfirm()).toBe(false);

    component.setSelection('amount', 'Debit');
    expect(component.canConfirm()).toBe(true);
  });

  it('confirm() closes the dialog with the confirmed mapping', () => {
    let closedWith: unknown;
    const component = createComponent(
      {
        proposal: {
          bankId: 'chase',
          csvS3Key: 'stmt.csv',
          mapped: { date: 'Posting Date', merchant: 'Description', amount: 'Amount' },
          unmappedColumns: [],
          isKnownBank: true,
        },
      },
      { close: (r) => (closedWith = r) }
    );

    component.confirm();
    expect(closedWith).toEqual({ date: 'Posting Date', merchant: 'Description', amount: 'Amount' });
  });

  it('a user reassigning an auto-matched column overrides the backend guess', () => {
    const component = createComponent(
      {
        proposal: {
          bankId: 'chase',
          csvS3Key: 'stmt.csv',
          mapped: { date: 'Posting Date', merchant: 'Description', amount: 'Amount' },
          unmappedColumns: ['Post Date'],
          isKnownBank: true,
        },
      },
      { close: () => {} }
    );

    component.setSelection('date', 'Post Date');
    expect(component.selections().date).toBe('Post Date');
  });
});
