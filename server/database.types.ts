export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          action_url: string | null
          alert_type: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          student_id: string | null
          target_audience: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          alert_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id: string
          is_read?: boolean | null
          message: string
          student_id?: string | null
          target_audience?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          alert_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          student_id?: string | null
          target_audience?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_number: number
          coach_notes: string | null
          created_at: string | null
          date: string
          duration_minutes: number | null
          id: string
          marked_by: string | null
          status: string
          student_id: string
          topic_covered: string | null
        }
        Insert: {
          class_number?: number
          coach_notes?: string | null
          created_at?: string | null
          date: string
          duration_minutes?: number | null
          id: string
          marked_by?: string | null
          status?: string
          student_id: string
          topic_covered?: string | null
        }
        Update: {
          class_number?: number
          coach_notes?: string | null
          created_at?: string | null
          date?: string
          duration_minutes?: number | null
          id?: string
          marked_by?: string | null
          status?: string
          student_id?: string
          topic_covered?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          address: string | null
          created_at: string | null
          date_of_joining: string | null
          date_of_leaving: string | null
          designation: string | null
          educational_qualification: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          notes: string | null
          specializations: string[] | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          date_of_joining?: string | null
          date_of_leaving?: string | null
          designation?: string | null
          educational_qualification?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id: string
          notes?: string | null
          specializations?: string[] | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          date_of_joining?: string | null
          date_of_leaving?: string | null
          designation?: string | null
          educational_qualification?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          notes?: string | null
          specializations?: string[] | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_bookings: {
        Row: {
          coach_notes: string | null
          created_at: string | null
          id: string
          mode_of_learning: string | null
          parent_email: string | null
          parent_name: string
          parent_notes: string | null
          parent_phone: string
          preferred_date: string
          preferred_time_slot: string
          status: string | null
          student_age: number
          student_name: string
        }
        Insert: {
          coach_notes?: string | null
          created_at?: string | null
          id: string
          mode_of_learning?: string | null
          parent_email?: string | null
          parent_name: string
          parent_notes?: string | null
          parent_phone: string
          preferred_date: string
          preferred_time_slot: string
          status?: string | null
          student_age: number
          student_name: string
        }
        Update: {
          coach_notes?: string | null
          created_at?: string | null
          id?: string
          mode_of_learning?: string | null
          parent_email?: string | null
          parent_name?: string
          parent_notes?: string | null
          parent_phone?: string
          preferred_date?: string
          preferred_time_slot?: string
          status?: string | null
          student_age?: number
          student_name?: string
        }
        Relationships: []
      }
      fee_reminders: {
        Row: {
          amount_due: number | null
          due_date: string | null
          id: string
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          sent_at: string | null
          status: string | null
          student_id: string
        }
        Insert: {
          amount_due?: number | null
          due_date?: string | null
          id: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          sent_at?: string | null
          status?: string | null
          student_id: string
        }
        Update: {
          amount_due?: number | null
          due_date?: string | null
          id?: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          sent_at?: string | null
          status?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_reminders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          date: string
          gpay_utr_ref: string | null
          id: string
          milestone: string | null
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          receipt_number: string
          screenshot_url: string | null
          status: string
          student_id: string
          verified_at: string | null
          verified_by: string | null
          year_month: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          date: string
          gpay_utr_ref?: string | null
          id: string
          milestone?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          receipt_number: string
          screenshot_url?: string | null
          status?: string
          student_id: string
          verified_at?: string | null
          verified_by?: string | null
          year_month: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          date?: string
          gpay_utr_ref?: string | null
          id?: string
          milestone?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          receipt_number?: string
          screenshot_url?: string | null
          status?: string
          student_id?: string
          verified_at?: string | null
          verified_by?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_trackers: {
        Row: {
          after_image_url: string | null
          alignment_stars: number | null
          baseline_speed_wpm: number | null
          before_image_url: string | null
          created_at: string | null
          current_score: number | null
          evaluation_date: string | null
          evaluation_title: string
          formation_stars: number | null
          grip_posture_stars: number | null
          id: string
          is_unlocked: boolean | null
          next_steps: string | null
          overall_remark: string | null
          overall_stars: number | null
          pressure_level: string | null
          skills: Json | null
          spacing_stars: number | null
          speed_stars: number | null
          speed_wpm: number | null
          student_id: string
          target_score: number | null
          teacher_feedback: string | null
          updated_at: string | null
        }
        Insert: {
          after_image_url?: string | null
          alignment_stars?: number | null
          baseline_speed_wpm?: number | null
          before_image_url?: string | null
          created_at?: string | null
          current_score?: number | null
          evaluation_date?: string | null
          evaluation_title: string
          formation_stars?: number | null
          grip_posture_stars?: number | null
          id: string
          is_unlocked?: boolean | null
          next_steps?: string | null
          overall_remark?: string | null
          overall_stars?: number | null
          pressure_level?: string | null
          skills?: Json | null
          spacing_stars?: number | null
          speed_stars?: number | null
          speed_wpm?: number | null
          student_id: string
          target_score?: number | null
          teacher_feedback?: string | null
          updated_at?: string | null
        }
        Update: {
          after_image_url?: string | null
          alignment_stars?: number | null
          baseline_speed_wpm?: number | null
          before_image_url?: string | null
          created_at?: string | null
          current_score?: number | null
          evaluation_date?: string | null
          evaluation_title?: string
          formation_stars?: number | null
          grip_posture_stars?: number | null
          id?: string
          is_unlocked?: boolean | null
          next_steps?: string | null
          overall_remark?: string | null
          overall_stars?: number | null
          pressure_level?: string | null
          skills?: Json | null
          spacing_stars?: number | null
          speed_stars?: number | null
          speed_wpm?: number | null
          student_id?: string
          target_score?: number | null
          teacher_feedback?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_trackers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string
          key: string
          reset_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          key: string
          reset_at: string
        }
        Update: {
          count?: number
          created_at?: string
          key?: string
          reset_at?: string
        }
        Relationships: []
      }
      receipt_counters: {
        Row: {
          date_key: string
          last_seq: number
          student_id: string
        }
        Insert: {
          date_key: string
          last_seq?: number
          student_id: string
        }
        Update: {
          date_key?: string
          last_seq?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_counters_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_works: {
        Row: {
          coach_annotation: string | null
          created_at: string | null
          file_url: string
          id: string
          score: number | null
          status: string | null
          student_id: string
          submitted_date: string | null
          thumbnail_url: string | null
          title: string
          work_type: string | null
        }
        Insert: {
          coach_annotation?: string | null
          created_at?: string | null
          file_url: string
          id: string
          score?: number | null
          status?: string | null
          student_id: string
          submitted_date?: string | null
          thumbnail_url?: string | null
          title: string
          work_type?: string | null
        }
        Update: {
          coach_annotation?: string | null
          created_at?: string | null
          file_url?: string
          id?: string
          score?: number | null
          status?: string | null
          student_id?: string
          submitted_date?: string | null
          thumbnail_url?: string | null
          title?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_works_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          age: number
          attended_classes: number | null
          avatar_url: string | null
          coach_id: string | null
          created_at: string | null
          diagnostic_observations: Json | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrollment_date: string | null
          grade: string | null
          id: string
          mode_of_learning: string | null
          notes: string | null
          parent_name: string
          preferred_slot: string | null
          school_name: string | null
          status: string
          total_classes: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          age: number
          attended_classes?: number | null
          avatar_url?: string | null
          coach_id?: string | null
          created_at?: string | null
          diagnostic_observations?: Json | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string | null
          grade?: string | null
          id: string
          mode_of_learning?: string | null
          notes?: string | null
          parent_name: string
          preferred_slot?: string | null
          school_name?: string | null
          status?: string
          total_classes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          age?: number
          attended_classes?: number | null
          avatar_url?: string | null
          coach_id?: string | null
          created_at?: string | null
          diagnostic_observations?: Json | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrollment_date?: string | null
          grade?: string | null
          id?: string
          mode_of_learning?: string | null
          notes?: string | null
          parent_name?: string
          preferred_slot?: string | null
          school_name?: string | null
          status?: string
          total_classes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          created_at: string | null
          grade: string | null
          handwriting_style: string | null
          id: string
          image: string | null
          is_featured: boolean | null
          parent_name: string
          rating: number
          review: string | null
          status: string | null
          student_id: string | null
          student_name: string
          title: string | null
          verified_student: boolean | null
        }
        Insert: {
          created_at?: string | null
          grade?: string | null
          handwriting_style?: string | null
          id: string
          image?: string | null
          is_featured?: boolean | null
          parent_name: string
          rating?: number
          review?: string | null
          status?: string | null
          student_id?: string | null
          student_name: string
          title?: string | null
          verified_student?: boolean | null
        }
        Update: {
          created_at?: string | null
          grade?: string | null
          handwriting_style?: string | null
          id?: string
          image?: string | null
          is_featured?: boolean | null
          parent_name?: string
          rating?: number
          review?: string | null
          status?: string | null
          student_id?: string | null
          student_name?: string
          title?: string | null
          verified_student?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_audit_logs: {
        Row: {
          action_summary: string
          actor_student_id: string | null
          actor_username: string | null
          arguments: Json | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          execution_mode: string | null
          id: string
          input_payload: Json | null
          output_result: Json | null
          result: Json | null
          status: string | null
          tool_name: string
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action_summary: string
          actor_student_id?: string | null
          actor_username?: string | null
          arguments?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          execution_mode?: string | null
          id: string
          input_payload?: Json | null
          output_result?: Json | null
          result?: Json | null
          status?: string | null
          tool_name: string
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action_summary?: string
          actor_student_id?: string | null
          actor_username?: string | null
          arguments?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          execution_mode?: string | null
          id?: string
          input_payload?: Json | null
          output_result?: Json | null
          result?: Json | null
          status?: string | null
          tool_name?: string
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          password_hash: string
          phone: string
          reset_password_expiry: number | null
          reset_password_token: string | null
          role: string
          token_version: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          first_name?: string
          id: string
          is_active?: boolean
          last_name?: string
          password_hash?: string
          phone?: string
          reset_password_expiry?: number | null
          reset_password_token?: string | null
          role: string
          token_version?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          password_hash?: string
          phone?: string
          reset_password_expiry?: number | null
          reset_password_token?: string | null
          role?: string
          token_version?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_rate_limit: {
        Args: { p_key: string; p_max_calls: number; p_window_seconds: number }
        Returns: Json
      }
      get_auth_user_by_identifier: {
        Args: { p_identifier: string }
        Returns: {
          avatar_url: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          password_hash: string
          phone: string
          role: string
          token_version: number
        }[]
      }
      set_request_context: {
        Args: {
          p_coach_id?: string
          p_role: string
          p_student_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
