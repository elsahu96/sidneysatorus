export interface GeolocationItem {
  entity: string;
  coordinates: [number, number];
  type?: string;
  context: string;
}

export interface ReportSource {
  title: string;
  url: string;
  date: string;
  key_insight: string;
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
