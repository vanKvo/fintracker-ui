import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import {
  ReportsService,
  AiInsight,
  AiNarrative,
  CategoryBreakdownRow,
  ComparisonMetric,
  EmergencyFund,
  InsightKind,
  MerchantRow,
  PeriodOption
} from '../../core/services/reports.service';

/** A metric with its period-over-period delta already resolved for the template. */
interface MetricView extends ComparisonMetric {
  displayValue: string;
  deltaLabel: string;
  /** 'good' | 'bad' | 'flat' — drives colour, decoupled from the direction of movement. */
  tone: 'good' | 'bad' | 'flat';
  direction: 'up' | 'down' | 'flat';
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    MatSnackBarModule,
    BaseChartDirective
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class Reports implements OnInit {
  // Assigned in the constructor, not inline: field initialisers run before constructor-injected
  // parameters are available.
  readonly periods: PeriodOption[];

  /**
   * Defaults to the last *complete* month rather than the current one. A report analyses a closed
   * period — a partial month produces misleading period-over-period deltas — which is also what
   * separates this page from the Dashboard's live current-month view.
   */
  readonly selectedPeriod = signal('last-month');

  readonly loading = signal(true);
  readonly narrativeLoading = signal(true);

  readonly metrics = signal<MetricView[]>([]);
  readonly categories = signal<CategoryBreakdownRow[]>([]);
  readonly merchants = signal<MerchantRow[]>([]);
  readonly insights = signal<AiInsight[]>([]);
  readonly narrative = signal<AiNarrative | null>(null);

  readonly categoryColumns = ['category', 'amount', 'previous', 'change', 'share'];
  readonly merchantColumns = ['merchant', 'category', 'count', 'average', 'amount'];

  readonly selectedPeriodLabel = computed(
    () => this.periods.find(p => p.value === this.selectedPeriod())?.viewValue ?? ''
  );
  readonly baselineLabel = computed(
    () => this.periods.find(p => p.value === this.selectedPeriod())?.baselineLabel ?? ''
  );

  /** Insights are surfaced most-actionable-first; 'trend' is informational so it sinks. */
  private readonly insightPriority: Record<InsightKind, number> = {
    risk: 0,
    anomaly: 1,
    opportunity: 2,
    trend: 3
  };

  readonly sortedInsights = computed(() =>
    [...this.insights()].sort((a, b) => this.insightPriority[a.kind] - this.insightPriority[b.kind])
  );

  /* --- Emergency fund runway calculator --- */

  readonly emergencyFund = signal<EmergencyFund | null>(null);
  /** Months of expenses the user wants covered — the one figure they drive directly. */
  readonly targetMonths = signal(6);

  /** How many months the current balance actually covers at trailing average spend. */
  readonly runwayMonths = computed(() => {
    const fund = this.emergencyFund();
    if (!fund || fund.avgMonthlyExpenses <= 0) {
      return 0;
    }
    return fund.currentBalance / fund.avgMonthlyExpenses;
  });

  readonly targetAmount = computed(() => (this.emergencyFund()?.avgMonthlyExpenses ?? 0) * this.targetMonths());

  /** Positive means short of target, negative means ahead of it. */
  readonly fundGap = computed(() => this.targetAmount() - (this.emergencyFund()?.currentBalance ?? 0));

  /** Progress toward target, capped at 100 so the bar never overflows its track. */
  readonly fundProgress = computed(() => {
    const target = this.targetAmount();
    if (target <= 0) {
      return 0;
    }
    return Math.min(100, ((this.emergencyFund()?.currentBalance ?? 0) / target) * 100);
  });

  readonly runwayTone = computed<'good' | 'warn' | 'bad'>(() => {
    const runway = this.runwayMonths();
    if (runway >= this.targetMonths()) {
      return 'good';
    }
    return runway >= 3 ? 'warn' : 'bad';
  });

  onTargetMonthsChange(value: string) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      this.targetMonths.set(parsed);
    }
  }

  readonly savingsChartData = signal<ChartConfiguration<'line'>['data']>({ labels: [], datasets: [] });

  /**
   * Six-month horizon, deliberately wider than the selected reporting period — the point of this
   * chart is to place the period in a longer trend, which the Dashboard's in-range trend cannot show.
   */
  readonly savingsChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, pointStyle: 'circle' } }
    },
    scales: {
      y: {
        position: 'left',
        title: { display: true, text: 'Savings rate (%)' },
        grid: { color: '#f1f5f9' },
        ticks: { callback: value => `${value}%` }
      },
      y1: {
        position: 'right',
        title: { display: true, text: 'Net cashflow ($)' },
        grid: { drawOnChartArea: false }
      },
      x: { grid: { display: false } }
    }
  };

  constructor(
    private reportsService: ReportsService,
    private snackBar: MatSnackBar
  ) {
    this.periods = this.reportsService.periods;
  }

  ngOnInit() {
    this.loadReport();
  }

  onPeriodChange(period: string) {
    this.selectedPeriod.set(period);
    this.loadReport();
  }

  regenerateNarrative() {
    this.narrativeLoading.set(true);
    this.narrative.set(null);
    this.fetchNarrative();
  }

  /** DEMO STATE: export is stubbed — the file-generation endpoint is not wired up yet. */
  onExport(format: 'CSV' | 'PDF') {
    this.snackBar.open(`${format} export is not wired up yet.`, 'Dismiss', { duration: 4000 });
  }

  private loadReport() {
    this.loading.set(true);
    this.narrativeLoading.set(true);
    this.narrative.set(null);

    this.reportsService
      .getReport(this.selectedPeriod())
      .pipe(catchError(() => of(null)))
      .subscribe(data => {
        if (!data) {
          this.snackBar.open('Report data failed to load.', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
          return;
        }

        this.metrics.set(data.metrics.map(m => this.toMetricView(m)));
        this.categories.set(data.categories);
        this.merchants.set(data.merchants);
        this.insights.set(data.insights);
        this.emergencyFund.set(data.emergencyFund);

        this.savingsChartData.set({
          labels: data.savingsHistory.map(p => p.month),
          datasets: [
            {
              data: data.savingsHistory.map(p => p.savingsRate),
              label: 'Savings rate',
              borderColor: '#155E37',
              backgroundColor: 'rgba(21, 94, 55, 0.08)',
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              yAxisID: 'y'
            },
            {
              data: data.savingsHistory.map(p => p.netCashflow),
              label: 'Net cashflow',
              borderColor: '#94A3B8',
              backgroundColor: 'transparent',
              borderDash: [5, 4],
              fill: false,
              tension: 0.35,
              pointRadius: 3,
              yAxisID: 'y1'
            }
          ]
        });

        this.loading.set(false);
      });

    this.fetchNarrative();
  }

  private fetchNarrative() {
    this.reportsService
      .getAiNarrative(this.selectedPeriod())
      .pipe(catchError(() => of(null)))
      .subscribe(narrative => {
        if (!narrative) {
          this.snackBar.open('AI summary could not be generated.', 'Dismiss', { duration: 5000 });
        }
        this.narrative.set(narrative);
        this.narrativeLoading.set(false);
      });
  }

  private toMetricView(metric: ComparisonMetric): MetricView {
    const diff = metric.value - metric.previousValue;
    // Percentages compare in percentage points; a "% change of a %" reads as nonsense to users.
    const isPoints = metric.format === 'percent';
    const relative = metric.previousValue === 0 ? 0 : (diff / Math.abs(metric.previousValue)) * 100;
    const magnitude = isPoints ? Math.abs(diff) : Math.abs(relative);

    // Sub-0.05 movements round to "0.0" — label them flat rather than showing a signed zero.
    const isFlat = magnitude < 0.05;
    const direction: MetricView['direction'] = isFlat ? 'flat' : diff > 0 ? 'up' : 'down';
    const tone: MetricView['tone'] = isFlat ? 'flat' : diff > 0 === metric.higherIsBetter ? 'good' : 'bad';

    const sign = isFlat ? '' : diff > 0 ? '+' : '−';
    const deltaLabel = isFlat
      ? 'No change'
      : `${sign}${magnitude.toFixed(1)}${isPoints ? ' pts' : '%'}`;

    return {
      ...metric,
      displayValue: this.formatMetric(metric.value, metric.format),
      deltaLabel,
      tone,
      direction
    };
  }

  private formatMetric(value: number, format: ComparisonMetric['format']): string {
    if (format === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  /** Period-over-period change for a category row, as a signed percentage string. */
  categoryChange(row: CategoryBreakdownRow): string {
    if (row.previousAmount === 0) {
      return 'New';
    }
    const change = ((row.amount - row.previousAmount) / row.previousAmount) * 100;
    if (Math.abs(change) < 0.05) {
      return '0.0%';
    }
    return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}%`;
  }

  categoryChangeTone(row: CategoryBreakdownRow): 'up' | 'down' | 'flat' {
    if (row.previousAmount === 0) {
      return 'up';
    }
    const change = row.amount - row.previousAmount;
    if (Math.abs(change) < 0.005) {
      return 'flat';
    }
    return change > 0 ? 'up' : 'down';
  }

  averageTransaction(row: MerchantRow): number {
    return row.transactionCount === 0 ? 0 : row.amount / row.transactionCount;
  }

  insightIcon(kind: InsightKind): string {
    switch (kind) {
      case 'anomaly':
        return 'warning_amber';
      case 'opportunity':
        return 'savings';
      case 'risk':
        return 'trending_down';
      case 'trend':
        return 'insights';
    }
  }

  insightLabel(kind: InsightKind): string {
    switch (kind) {
      case 'anomaly':
        return 'Anomaly';
      case 'opportunity':
        return 'Opportunity';
      case 'risk':
        return 'Risk';
      case 'trend':
        return 'Trend';
    }
  }

  /** Impact framing differs by insight type: a saving, an exposure, or nothing to quantify. */
  impactLabel(insight: AiInsight): string | null {
    if (insight.impactAmount === 0) {
      return null;
    }
    const amount = insight.impactAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    return insight.kind === 'opportunity' ? `${amount} / yr potential saving` : `${amount} impact`;
  }
}
