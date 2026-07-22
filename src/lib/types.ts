export type UserRole = "admin" | "driver";

export type ProjectStatus = "planning" | "active" | "completed" | "cancelled";

export type LocationStatus =
  | "unassigned"
  | "assigned"
  | "in_progress"
  | "completed"
  | "failed";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  project_id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  notes: string | null;
  status: LocationStatus;
  assigned_driver_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverPosition {
  id: number;
  driver_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface PhotoReport {
  id: string;
  location_id: string;
  driver_id: string;
  notes: string | null;
  photo_urls: string[];
  submitted_at: string;
}

export interface LocationWithProject extends Location {
  project?: Project;
}

export interface LocationWithDriver extends Location {
  driver?: Profile | null;
}
