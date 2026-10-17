// Schema mirrors the existing Supabase project (probed from the live tables).
// Regenerate with `npx supabase gen types typescript` once CLI access is set up.

export type ExperimentStatus = 'ongoing' | 'succeeded' | 'failed'

/** Phase of a check-in: 'propagation' = Phase 1, 'potted' = Phase 2. */
export type LogPhase = 'propagation' | 'potted'

/** One pot in a `create_potting` call. A blank label becomes "Pot N". */
export interface PotInput {
  label?: string | null
  plant_count: number
  pot_size?: string | null
  substrate?: string | null
  notes?: string | null
  image_url?: string | null
}

// Soft-delete bookkeeping (see db/2026-08-31_soft_delete_bin.sql) is repeated
// inline on every binnable table below rather than mixed in as an intersection:
// supabase-js infers its query result types from these shapes, and an
// intersection makes that inference collapse to `never`.
//   deleted_at       null = live
//   delete_batch_id  groups everything removed by one delete action
//   deleted_root     true on the row the user actually deleted

export interface Database {
  public: {
    Tables: {
      folders: {
        Row: {
          id: string
          user_id: string
          title: string
          plant_count: number | null
          origin: string | null
          initial_price: number | null
          notes: string | null
          cover_image_url: string | null
          care_task_label: string | null
          care_interval_days: number | null
          care_last_done_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          delete_batch_id: string | null
          deleted_root: boolean
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          plant_count?: number | null
          origin?: string | null
          initial_price?: number | null
          notes?: string | null
          cover_image_url?: string | null
          care_task_label?: string | null
          care_interval_days?: number | null
          care_last_done_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          delete_batch_id?: string | null
          deleted_root?: boolean
        }
        Update: Partial<Database['public']['Tables']['folders']['Insert']>
        Relationships: []
      }
      experiments: {
        Row: {
          id: string
          user_id: string
          folder_id: string
          title: string
          plant_count: number | null
          origin: string | null
          initial_price: number | null
          notes: string | null
          cover_image_url: string | null
          started_on: string
          status: ExperimentStatus
          care_task_label: string | null
          care_interval_days: number | null
          care_last_done_on: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          delete_batch_id: string | null
          deleted_root: boolean
        }
        Insert: {
          id?: string
          user_id?: string
          folder_id: string
          title: string
          plant_count?: number | null
          origin?: string | null
          initial_price?: number | null
          notes?: string | null
          cover_image_url?: string | null
          started_on?: string
          status?: ExperimentStatus
          care_task_label?: string | null
          care_interval_days?: number | null
          care_last_done_on?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          delete_batch_id?: string | null
          deleted_root?: boolean
        }
        Update: Partial<Database['public']['Tables']['experiments']['Insert']>
        Relationships: []
      }
      date_logs: {
        Row: {
          id: string
          experiment_id: string
          log_date: string
          status_details: string
          image_url: string | null
          // Per check-in stage tally: how many plants currently sit in each
          // root/shoot bucket. Null on entries that didn't record stages
          // (photo-only, quick watered/fertilized, pre-2026-09-09 rows).
          r0_count: number | null
          r1_count: number | null
          r2_count: number | null
          s0_count: number | null
          s1_count: number | null
          s2_count: number | null
          s3_count: number | null
          /** Plants that are S1+ but still R0 — an early reserve-spend risk. */
          leafing_without_rooting: number | null
          deaths_count: number
          death_cause: string | null
          watered: boolean
          fertilized: boolean
          /** 'propagation' (Phase 1) or 'potted' (Phase 2). See PHASE2_PLAN.md. */
          phase: LogPhase
          /** Required when phase = 'potted' (DB CHECK); null for Phase 1 logs. */
          pot_id: string | null
          /** Phase 2 health tally for the pot at this check-in. */
          health_good: number | null
          health_ok: number | null
          health_poor: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          delete_batch_id: string | null
          deleted_root: boolean
        }
        Insert: {
          id?: string
          experiment_id: string
          log_date: string
          status_details: string
          image_url?: string | null
          phase?: LogPhase
          pot_id?: string | null
          health_good?: number | null
          health_ok?: number | null
          health_poor?: number | null
          r0_count?: number | null
          r1_count?: number | null
          r2_count?: number | null
          s0_count?: number | null
          s1_count?: number | null
          s2_count?: number | null
          s3_count?: number | null
          leafing_without_rooting?: number | null
          deaths_count?: number
          death_cause?: string | null
          watered?: boolean
          fertilized?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          delete_batch_id?: string | null
          deleted_root?: boolean
        }
        Update: Partial<Database['public']['Tables']['date_logs']['Insert']>
        Relationships: []
      }
      pottings: {
        Row: {
          id: string
          experiment_id: string
          potted_on: string
          notes: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          delete_batch_id: string | null
          deleted_root: boolean
        }
        Insert: {
          id?: string
          experiment_id: string
          potted_on?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          delete_batch_id?: string | null
          deleted_root?: boolean
        }
        Update: Partial<Database['public']['Tables']['pottings']['Insert']>
        Relationships: []
      }
      pots: {
        Row: {
          id: string
          experiment_id: string
          potting_id: string
          label: string
          /** Plants put in this pot (>= 1). Pots are not plants. */
          plant_count: number
          pot_size: string | null
          substrate: string | null
          notes: string | null
          image_url: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          delete_batch_id: string | null
          deleted_root: boolean
        }
        Insert: {
          id?: string
          experiment_id: string
          potting_id: string
          label: string
          plant_count: number
          pot_size?: string | null
          substrate?: string | null
          notes?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          delete_batch_id?: string | null
          deleted_root?: boolean
        }
        Update: Partial<Database['public']['Tables']['pots']['Insert']>
        Relationships: []
      }
      pest_guides: {
        Row: {
          id: string
          pest_name: string
          treatment_steps: string[]
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          pest_name: string
          treatment_steps: string[]
          image_url?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['pest_guides']['Insert']>
        Relationships: []
      }
      tips: {
        Row: {
          id: string
          title: string
          content: string
          category: string | null
          subcategory: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          category?: string | null
          subcategory?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['tips']['Insert']>
        Relationships: []
      }
      notes: {
        Row: {
          id: string
          user_id: string
          body: string
          image_url: string | null
          created_at: string
          deleted_at: string | null
          delete_batch_id: string | null
          deleted_root: boolean
        }
        Insert: {
          id?: string
          user_id?: string
          body: string
          image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          delete_batch_id?: string | null
          deleted_root?: boolean
        }
        Update: Partial<Database['public']['Tables']['notes']['Insert']>
        Relationships: []
      }
      feeding_logs: {
        Row: {
          id: string
          user_id: string
          fed_on: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          fed_on?: string
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['feeding_logs']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      /**
       * Atomically inserts a potting and all its pots; raises if the plants moved
       * exceed Phase 1 remaining on `p_potted_on`. Each p_pots element:
       * { label?, plant_count, pot_size?, substrate?, notes?, image_url? }.
       */
      create_potting: {
        Args: {
          p_experiment_id: string
          p_potted_on: string
          p_notes: string | null
          p_pots: PotInput[]
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Folder = Database['public']['Tables']['folders']['Row']
export type Experiment = Database['public']['Tables']['experiments']['Row']
export type DateLog = Database['public']['Tables']['date_logs']['Row']
export type Potting = Database['public']['Tables']['pottings']['Row']
export type Pot = Database['public']['Tables']['pots']['Row']
export type PestGuide = Database['public']['Tables']['pest_guides']['Row']
export type Tip = Database['public']['Tables']['tips']['Row']
export type Note = Database['public']['Tables']['notes']['Row']
export type FeedingLog = Database['public']['Tables']['feeding_logs']['Row']
