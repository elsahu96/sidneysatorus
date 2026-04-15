export interface GeolocationItem {
  entity: string;
  coordinates: [number, number];
  type?: string;
  context: string;
}

export interface AnalystSignal {
  text: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface ReportSource {
  title: string;
  url: string;
  date: string;
  key_insight: string;
  // Grading fields — present on reports generated after grading pipeline
  grade?: string;
  composite_score?: number;
  factor_scores?: Record<string, number>;
  analyst_signals?: AnalystSignal[];
  source_name?: string;
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
