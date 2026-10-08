import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AddTransactionDialog, AddTransactionDialogData, CreateTransactionResult } from './add-transaction-dialog';

// TXT-01: a manual transaction carries one of the five types plus a direction.
describe('AddTransactionDialog', () => {
  const data: AddTransactionDialogData = {
    accounts: [{ accountId: 'acc-1', accountName: 'Checking' } as any],
    categories: ['Shopping'],
  };

  function createComponent(close: (r?: CreateTransactionResult) => void = () => {}) {
    TestBed.configureTestingModule({
      imports: [AddTransactionDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(AddTransactionDialog);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function fillRequiredFields(component: AddTransactionDialog) {
    component.accountId.set('acc-1');
    component.category.set('Shopping');
    component.merchant.set('Store');
    component.amount.set(25);
  }

  it('offers exactly the five transaction types', () => {
    const component = createComponent();

    expect(component.typeOptions.map(o => o.value)).toEqual(['EXPENSE', 'INCOME', 'REFUND', 'TRANSFER', 'ADJUSTMENT']);
  });

  it('defaults to an EXPENSE going out (DEBIT)', () => {
    const component = createComponent();

    expect(component.type()).toBe('EXPENSE');
    expect(component.direction()).toBe('DEBIT');
  });

  it.each([
    ['INCOME', 'CREDIT'],
    ['REFUND', 'CREDIT'],
    ['EXPENSE', 'DEBIT'],
  ] as const)('selecting %s sets the direction to %s', (type, direction) => {
    const component = createComponent();

    component.selectType(type);

    expect(component.direction()).toBe(direction);
  });

  it('keeps the chosen direction for TRANSFER and ADJUSTMENT, which can go either way', () => {
    const component = createComponent();
    component.direction.set('CREDIT');

    component.selectType('TRANSFER');
    expect(component.direction()).toBe('CREDIT');

    component.selectType('ADJUSTMENT');
    expect(component.direction()).toBe('CREDIT');
  });

  it('sends type and direction, with a negative amount for money out', () => {
    let result: CreateTransactionResult | undefined;
    const component = createComponent(r => (result = r));
    fillRequiredFields(component);
    component.selectType('TRANSFER');
    component.direction.set('DEBIT');

    component.confirm();

    expect(result).toMatchObject({ type: 'TRANSFER', direction: 'DEBIT', amount: -25 });
  });

  it('sends a positive amount for money in', () => {
    let result: CreateTransactionResult | undefined;
    const component = createComponent(r => (result = r));
    fillRequiredFields(component);
    component.selectType('REFUND');

    component.confirm();

    expect(result).toMatchObject({ type: 'REFUND', direction: 'CREDIT', amount: 25 });
  });
});
