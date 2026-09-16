/**
 * Bank institutions the data-pipeline has a baseline CSV column mapping
 * for (services/fintracker-data-pipeline/src/gatekeeper/bank_mappings.json,
 * loaded by bank_mapping_baseline.py). Citibank is deliberately excluded —
 * its export uses split Debit/Credit columns, which the pipeline's
 * single-`amount`-field model doesn't support yet.
 *
 * `id` must match the `bank_id` key the backend's mapping table is keyed
 * on exactly (lowercase, underscore-separated) — see mapping_repository.py.
 */
export interface BankInstitution {
  id: string;
  name: string;
}

export const BANK_INSTITUTIONS: BankInstitution[] = [
  { id: 'chase', name: 'JPMorgan Chase' },
  { id: 'bank_of_america', name: 'Bank of America' },
  { id: 'wells_fargo', name: 'Wells Fargo' },
  { id: 'capital_one', name: 'Capital One' },
  { id: 'us_bank', name: 'U.S. Bank' },
  { id: 'pnc_bank', name: 'PNC Bank' },
  { id: 'td_bank', name: 'TD Bank' },
  { id: 'discover', name: 'Discover Financial' },
  { id: 'charles_schwab', name: 'Charles Schwab' },
  { id: 'other', name: 'Other / Not Listed' },
];
