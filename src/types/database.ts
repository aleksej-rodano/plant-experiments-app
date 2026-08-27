// Schema mirrors the existing Supabase project (probed from the live tables).
// Regenerate with `npx supabase gen types typescript` once CLI access is set up.

export interface Database {
  public: {
    Tables: {
      experiments: {
        Row: {
          id: string
          user_id: string
          title: string
          plant_count: number
          origin: string
          initial_price: number | null
          notes: string | null
          cover_image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          plant_count: number
          origin: string
          initial_price?: number | null
          notes?: string | null
          cover_image_url?: string | null
          created_at?: string
          updated_at?: string
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          experiment_id: string
          log_date: string
          status_details: string
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['date_logs']['Insert']>
        Relationships: []
      }
      pest_guides: {
        Row: {
          id: string
          pest_name: string
          treatment_steps: string[]
          created_at: string
        }
        Insert: {
          id?: string
          pest_name: string
          treatment_steps: string[]
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
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['tips']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Experiment = Database['public']['Tables']['experiments']['Row']
export type DateLog = Database['public']['Tables']['date_logs']['Row']
export type PestGuide = Database['public']['Tables']['pest_guides']['Row']
export type Tip = Database['public']['Tables']['tips']['Row']
