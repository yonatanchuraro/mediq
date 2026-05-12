/**
 * Type definitions for our Supabase schema.
 *
 * These are hand-written for now; later we can regenerate via:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */

export type UserRole = 'admin' | 'doctor' | 'client';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Specialty {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Doctor {
  profile_id: string;
  specialty_id: string | null;
  bio: string | null;
  license_number: string | null;
  active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  specialty_id: string | null;
  active: boolean;
  created_at: string;
}

export interface WorkingHour {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string | null;
  end_time: string | null;
  is_open: boolean;
}

export interface Appointment {
  id: string;
  client_id: string;
  doctor_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  context: Record<string, unknown>;
  started_at: string;
  closed_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Minimal Database shape — expand or regenerate later. */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      doctors: { Row: Doctor; Insert: Partial<Doctor>; Update: Partial<Doctor> };
      services: { Row: Service; Insert: Partial<Service>; Update: Partial<Service> };
      working_hours: { Row: WorkingHour; Insert: Partial<WorkingHour>; Update: Partial<WorkingHour> };
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment> };
      chat_sessions: { Row: ChatSession; Insert: Partial<ChatSession>; Update: Partial<ChatSession> };
      chat_messages: { Row: ChatMessage; Insert: Partial<ChatMessage>; Update: Partial<ChatMessage> };
    };
  };
};
