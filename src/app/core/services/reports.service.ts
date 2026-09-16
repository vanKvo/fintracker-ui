import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

/**
 * Reports data contracts.
 *
 * The Reports page is period-comparison oriented: every figure is paired with the same figure
 * from a baseline period, because a report answers "what changed and why", where the Dashboard
 * answers "what is true right now".
 *
 * DEMO STATE: all data below is mocked in-memory. The real implementations are intended to be
 * the Analytics Service (`/api/v1/analytics/...`) for the aggregates and its Bedrock-backed
 * insight endpoints for `narrative` / `insights`. Swapping to live data means replacing the
 * `of(...)` bodies with `this.http.get(...)` calls — the component consumes only these types.
 */

export type InsightKind = 'anomaly' | 'opportunity' | 'risk' | 'trend';

export interface PeriodOption {
  value: string;
  viewValue: string;
  /** Label for the baseline this period is compared against. */
  baselineLabel: string;
}

/** A single headline figure with its baseline-period counterpart. */
export interface ComparisonMetric {
  label: string;
  value: number;
  previousValue: number;
  /** 'currency' renders as $, 'percent' renders as % and compares in percentage points. */
  format: 'currency' | 'percent';
  /**
   * Whether an increase is good. Expenses rising is bad; income rising is good. Drives the
   * up/down arrow colour so a red arrow always means "worse", never just "down".
   */
  higherIsBetter: boolean;
}

export interface CategoryBreakdownRow {
  category: string;
  amount: number;
  previousAmount: number;
  /** Share of total spend for the selected period, 0–1. */
  shareOfTotal: number;
  transactionCount: number;
}

export interface MerchantRow {
  merchant: string;
  category: string;
  amount: number;
  transactionCount: number;
}

export interface SavingsRatePoint {
  month: string;
  savingsRate: number;
  netCashflow: number;
}

/** The AI-generated narrative that headlines the report. */
export interface AiNarrative {
  headline: string;
  summary: string;
  keyFindings: string[];
  generatedAt: Date;
  model: string;
}

export interface AiInsight {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  /** Dollar impact of acting on (or ignoring) this insight. */
  impactAmount: number;
  recommendedAction: string;
}

/** Inputs for the emergency-fund runway calculator. */
export interface EmergencyFund {
  currentBalance: number;
  /** Trailing six-month average, so a single unusual month doesn't distort the runway. */
  avgMonthlyExpenses: number;
}

export interface ReportPeriodData {
  metrics: ComparisonMetric[];
  categories: CategoryBreakdownRow[];
  merchants: MerchantRow[];
  savingsHistory: SavingsRatePoint[];
  insights: AiInsight[];
  emergencyFund: EmergencyFund;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  readonly periods: PeriodOption[] = [
    { value: 'last-month', viewValue: 'July 2026', baselineLabel: 'June 2026' },
    { value: 'this-month', viewValue: 'August 2026 (partial)', baselineLabel: 'July 2026' },
    { value: 'last-quarter', viewValue: 'Q2 2026', baselineLabel: 'Q1 2026' },
    { value: 'this-year', viewValue: 'Year to date 2026', baselineLabel: '2025 same period' }
  ];

  /**
   * Simulated latency so the demo shows the real loading behaviour of the page rather than a
   * suspiciously instant render.
   */
  getReport(_period: string): Observable<ReportPeriodData> {
    return of(this.mockReport()).pipe(delay(450));
  }

  /**
   * Separate call from `getReport` on purpose: LLM generation is materially slower than the
   * aggregate queries, so the page renders its numbers first and streams the narrative in
   * afterwards rather than blocking the whole report on the model.
   */
  getAiNarrative(_period: string): Observable<AiNarrative> {
    return of(this.mockNarrative()).pipe(delay(1400));
  }

  private mockReport(): ReportPeriodData {
    return {
      metrics: [
        { label: 'Total Income', value: 8450.0, previousValue: 8200.0, format: 'currency', higherIsBetter: true },
        { label: 'Total Expenses', value: 5312.4, previousValue: 4689.14, format: 'currency', higherIsBetter: false },
        { label: 'Net Savings', value: 3137.6, previousValue: 3510.86, format: 'currency', higherIsBetter: true },
        { label: 'Savings Rate', value: 37.1, previousValue: 42.8, format: 'percent', higherIsBetter: true }
      ],
      categories: [
        { category: 'Housing', amount: 1850.0, previousAmount: 1850.0, shareOfTotal: 0.348, transactionCount: 2 },
        { category: 'Food & Dining', amount: 1124.8, previousAmount: 812.4, shareOfTotal: 0.212, transactionCount: 47 },
        { category: 'Shopping', amount: 758.9, previousAmount: 640.2, shareOfTotal: 0.143, transactionCount: 22 },
        { category: 'Transport', amount: 486.2, previousAmount: 502.75, shareOfTotal: 0.092, transactionCount: 14 },
        { category: 'Entertainment', amount: 412.3, previousAmount: 298.5, shareOfTotal: 0.078, transactionCount: 11 },
        { category: 'Utilities', amount: 342.6, previousAmount: 318.9, shareOfTotal: 0.065, transactionCount: 5 },
        { category: 'Health', amount: 187.6, previousAmount: 166.4, shareOfTotal: 0.035, transactionCount: 4 },
        { category: 'Subscriptions', amount: 150.0, previousAmount: 99.99, shareOfTotal: 0.028, transactionCount: 6 }
      ],
      merchants: [
        { merchant: 'Whole Foods Market', category: 'Food & Dining', amount: 412.85, transactionCount: 9 },
        { merchant: 'Amazon', category: 'Shopping', amount: 386.4, transactionCount: 14 },
        { merchant: 'Shell', category: 'Transport', amount: 248.9, transactionCount: 6 },
        { merchant: 'DoorDash', category: 'Food & Dining', amount: 237.15, transactionCount: 11 },
        { merchant: 'Starbucks', category: 'Food & Dining', amount: 118.6, transactionCount: 17 },
        { merchant: 'Apple', category: 'Subscriptions', amount: 89.97, transactionCount: 3 }
      ],
      savingsHistory: [
        { month: 'Feb', savingsRate: 44.2, netCashflow: 3580.4 },
        { month: 'Mar', savingsRate: 45.9, netCashflow: 3742.1 },
        { month: 'Apr', savingsRate: 43.1, netCashflow: 3498.6 },
        { month: 'May', savingsRate: 43.6, netCashflow: 3555.2 },
        { month: 'Jun', savingsRate: 42.8, netCashflow: 3510.86 },
        { month: 'Jul', savingsRate: 37.1, netCashflow: 3137.6 }
      ],
      emergencyFund: {
        currentBalance: 14200.0,
        avgMonthlyExpenses: 4847.2
      },
      insights: [
        {
          id: 'ins-food-spike',
          kind: 'anomaly',
          title: 'Food & Dining is 38% above last month',
          detail:
            'You spent $1,124.80 on Food & Dining in July versus $812.40 in June — $312.40 above your ' +
            'six-month average. Delivery is the driver: 11 DoorDash orders totalling $237.15, up from 3 orders in June.',
          impactAmount: 312.4,
          recommendedAction: 'Set a $950 monthly cap on Food & Dining'
        },
        {
          id: 'ins-subscription-creep',
          kind: 'opportunity',
          title: 'Subscription spend rose 50% to $150.00/mo',
          detail:
            'Six active subscriptions renewed in July, including two streaming services added mid-month that ' +
            'overlap in content library. Annualised, the overlap costs $384.',
          impactAmount: 384.0,
          recommendedAction: 'Cancel one overlapping streaming plan'
        },
        {
          id: 'ins-savings-decline',
          kind: 'risk',
          title: 'Savings rate has fallen three months running',
          detail:
            'Your savings rate dropped from 45.9% in March to 37.1% in July — a 5.7 point fall this month alone. ' +
            'Holding this trajectory, the Emergency Fund goal lands roughly seven weeks past its target date.',
          impactAmount: 1240.0,
          recommendedAction: 'Review the Emergency Fund contribution schedule'
        },
        {
          id: 'ins-fixed-costs-stable',
          kind: 'trend',
          title: 'Fixed costs held flat for a fifth month',
          detail:
            'Housing and Transport together account for 44% of spend and have not moved more than 3% in five months. ' +
            'Your variable spend is where the volatility is, which makes it the effective lever.',
          impactAmount: 0,
          recommendedAction: 'No action needed'
        }
      ]
    };
  }

  private mockNarrative(): AiNarrative {
    return {
      headline: 'A strong income month offset by a sharp rise in discretionary spending',
      summary:
        'July was your highest-earning month of the year at $8,450, up 3.0% on June. Despite that, net savings ' +
        'fell 10.6% to $3,137.60, because expenses climbed 13.3% to $5,312.40 — the largest month-over-month ' +
        'increase since February. The rise was almost entirely discretionary: Food & Dining, Entertainment and ' +
        'Shopping together added $545 of spend, while your fixed costs stayed flat. Your savings rate of 37.1% ' +
        'remains healthy in absolute terms, but this is the third consecutive month of decline and the steepest ' +
        'of the three.',
      keyFindings: [
        'Discretionary categories drove 87% of the increase in total spending',
        'Food delivery orders nearly quadrupled month over month',
        'Fixed costs remain stable at 44% of total spend, giving you room to correct'
      ],
      generatedAt: new Date(),
      model: 'Claude on Amazon Bedrock'
    };
  }
}
