import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type MetricsMeta = {
  measured?: string[]
  derived?: string[]
  unavailable?: string[]
  notes?: string
}

export type Database = {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string
          name: string
          age: number
          condition: string
          medications: string[]
          clinician_id: string | null
          created_at: string
          external_subject_id: string | null
          data_source: string | null
          display_name: string | null
          chart_notes: string | null
          care_status: string | null
        }
      }
      wearable_readings: {
        Row: {
          id: string
          patient_id: string
          recorded_at: string
          hr: number | null
          hrv_ms: number | null
          spo2: number | null
          steps: number | null
          sleep_duration_min: number | null
          sleep_deep_min: number | null
          rr: number | null
          skin_temp_delta: number | null
          sedentary_min: number | null
          very_active_min: number | null
          calories: number | null
          metrics_meta: MetricsMeta | null
        }
      }
      baselines: {
        Row: {
          patient_id: string
          metric: string
          rolling_mean: number
          rolling_std: number
          window_days: number
          updated_at: string
        }
      }
      anomalies: {
        Row: {
          id: string
          patient_id: string
          metric: string
          triggered_at: string
          z_score: number
          severity: 'low' | 'medium' | 'high'
          value: number
          baseline_mean: number
          clinical_context: string | null
          evidence_snippets: string[] | null
          reviewed_by: string | null
          clinician_note: string | null
          reviewed_at: string | null
          status: 'pending' | 'reviewed' | 'dismissed'
          created_at: string
        }
      }
      reports: {
        Row: {
          id: string
          patient_id: string
          period_start: string
          period_end: string
          narrative: string
          summary_json: Record<string, unknown>
          created_at: string
        }
      }
      knowledge_chunks: {
        Row: {
          id: string
          source: string
          content: string
          embedding: number[]
        }
      }
      care_messages: {
        Row: {
          id: string
          patient_id: string
          author_role: 'clinician' | 'patient'
          body: string
          topic: string
          created_at: string
          read_at: string | null
        }
      }
    }
  }
}
