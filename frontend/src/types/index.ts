export interface GeolocationItem {
  entity: string;
  coordinates: [number, number];
  type?: string;
  context: string;
}

export interface SourceFactorScores {
  factual_reliability: number;
  source_authority: number;
  bias_objectivity: number;
  attribution_quality: number;
  press_environment: number;
  corroboration: number;
}

export interface ReportSource {
  title: string;
  url: string;
  date: string;
  key_insight: string;
  grade?: string;
  composite_score?: number;
  factor_scores?: SourceFactorScores;
  analyst_signals?: Array<{ text: string; sentiment?: string }>;
}

export interface ReportMetadata {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  created_at: Date;
  content?: string;
  geolocations?: GeolocationItem[];
  sources?: ReportSource[];
}
