import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs the combined category list', () => {
    let result: any;
    service.getCategories().subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/ledger/categories');
    expect(req.request.method).toBe('GET');
    req.flush([
      { categoryId: 'c1', displayName: 'Groceries', level: 'SYSTEM' },
      { categoryId: 'c2', displayName: 'Side Hustle', level: 'USER' },
    ]);

    expect(result.length).toBe(2);
    expect(result[1].level).toBe('USER');
  });

  it('POSTs a new custom category', () => {
    let result: any;
    service.createCategory('Auto Property Tax').subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/ledger/categories');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ categoryName: 'Auto Property Tax' });
    req.flush({ categoryId: 'c3', displayName: 'Auto Property Tax', level: 'USER' });

    expect(result.categoryId).toBe('c3');
  });

  it('PUTs a rename to /{categoryId}', () => {
    service.updateCategory('c2', 'Freelance Income').subscribe();

    const req = httpMock.expectOne('/api/v1/ledger/categories/c2');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ categoryName: 'Freelance Income' });
    req.flush({ categoryId: 'c2', displayName: 'Freelance Income', level: 'USER' });
  });

  it('GETs usage at /{categoryId}/usage', () => {
    let result: any;
    service.getUsage('c2').subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/ledger/categories/c2/usage');
    expect(req.request.method).toBe('GET');
    req.flush({ transactionCount: 3 });

    expect(result.transactionCount).toBe(3);
  });

  it('DELETEs without a body when no reassignment target is given', () => {
    service.deleteCategory('c2').subscribe();

    const req = httpMock.expectOne('/api/v1/ledger/categories/c2');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toBeNull();
    req.flush(null);
  });

  it('DELETEs with a reassignToCategoryId body when given', () => {
    service.deleteCategory('c2', 'c1').subscribe();

    const req = httpMock.expectOne('/api/v1/ledger/categories/c2');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ reassignToCategoryId: 'c1' });
    req.flush(null);
  });
});
