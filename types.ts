export interface Session {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  session_type: string;
  meeting_key: number;
  location: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  year: number;
}

export interface Driver {
  session_key: number;
  meeting_key: number;
  broadcast_name: string;
  country_code: string;
  driver_number: number;
  first_name: string;
  full_name: string;
  headshot_url: string | null;
  last_name: string;
  team_colour: string;
  team_name: string;
  name_acronym: string;
}

export interface Lap {
  meeting_key: number;
  session_key: number;
  driver_number: number;
  lap_number: number;
  date_start: string;
  lap_duration: number; // in seconds if calculated, usually null in raw stream, need 'lap_duration' from OpenF1
  is_pit_out_lap: boolean;
  duration_sector_1: number;
  duration_sector_2: number;
  duration_sector_3: number;
  segments_sector_1: number[];
  segments_sector_2: number[];
  segments_sector_3: number[];
  st_speed: number; // speed trap
}

export interface CarData {
  date: string; // ISO timestamp
  driver_number: number;
  rpm: number;
  speed: number;
  n_gear: number;
  throttle: number;
  brake: number;
  drs: number;
  meeting_key: number;
  session_key: number;
}

export interface LocationData {
  date: string;
  driver_number: number;
  x: number;
  y: number;
  z: number;
  meeting_key: number;
  session_key: number;
}

export interface TelemetryPoint {
  date: string; // Time relative to lap start or absolute
  distance?: number; // Calculated distance
  speed: number;
  throttle: number;
  brake: number;
  rpm: number;
  gear: number;
  driver: string;
  color: string;
}

export interface StagedLap {
  id: string; // Unique ID: driverNumber_lapNumber
  driver: Driver;
  lap: Lap;
  color: string; // Assigned Tremor color
}