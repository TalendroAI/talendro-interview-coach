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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          feedback: Json | null
          id: string
          question_number: number | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          feedback?: Json | null
          id?: string
          question_number?: number | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          feedback?: Json | null
          id?: string
          question_number?: number | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_sessions: {
        Row: {
          company_url: string | null
          completed_at: string | null
          created_at: string
          current_question_number: number | null
          email: string
          first_name: string | null
          id: string
          job_description: string | null
          paused_at: string | null
          prep_packet: Json | null
          profile_id: string | null
          resume_text: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          status: Database["public"]["Enums"]["session_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          company_url?: string | null
          completed_at?: string | null
          created_at?: string
          current_question_number?: number | null
          email: string
          first_name?: string | null
          id?: string
          job_description?: string | null
          paused_at?: string | null
          prep_packet?: Json | null
          profile_id?: string | null
          resume_text?: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_url?: string | null
          completed_at?: string | null
          created_at?: string
          current_question_number?: number | null
          email?: string
          first_name?: string | null
          id?: string
          job_description?: string | null
          paused_at?: string | null
          prep_packet?: Json | null
          profile_id?: string | null
          resume_text?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_usage: {
        Row: {
          code_id: string
          email: string
          id: string
          session_id: string | null
          used_at: string
        }
        Insert: {
          code_id: string
          email: string
          id?: string
          session_id?: string | null
          used_at?: string
        }
        Update: {
          code_id?: string
          email?: string
          id?: string
          session_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applicable_products: string[] | null
          code: string
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          is_active: boolean
          max_uses: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_products?: string[] | null
          code: string
          created_at?: string
          description?: string | null
          discount_percent: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_products?: string[] | null
          code?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          admin_notified_at: string | null
          ai_resolution_attempted: boolean | null
          ai_resolution_response: string | null
          ai_resolution_successful: boolean | null
          context: Json | null
          created_at: string
          error_code: string | null
          error_message: string
          error_type: string
          escalated_to_admin: boolean | null
          id: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          session_id: string | null
          user_email: string | null
        }
        Insert: {
          admin_notified_at?: string | null
          ai_resolution_attempted?: boolean | null
          ai_resolution_response?: string | null
          ai_resolution_successful?: boolean | null
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_message: string
          error_type: string
          escalated_to_admin?: boolean | null
          id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          session_id?: string | null
          user_email?: string | null
        }
        Update: {
          admin_notified_at?: string | null
          ai_resolution_attempted?: boolean | null
          ai_resolution_response?: string | null
          ai_resolution_successful?: boolean | null
          context?: Json | null
          created_at?: string
          error_code?: string | null
          error_message?: string
          error_type?: string
          escalated_to_admin?: boolean | null
          id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          session_id?: string | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_pro_subscriber: boolean | null
          pro_audio_sessions_used: number
          pro_cancel_at_period_end: boolean | null
          pro_mock_sessions_used: number
          pro_quick_prep_sessions_used: number
          pro_session_reset_date: string | null
          pro_subscription_end: string | null
          pro_subscription_start: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_pro_subscriber?: boolean | null
          pro_audio_sessions_used?: number
          pro_cancel_at_period_end?: boolean | null
          pro_mock_sessions_used?: number
          pro_quick_prep_sessions_used?: number
          pro_session_reset_date?: string | null
          pro_subscription_end?: string | null
          pro_subscription_start?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_pro_subscriber?: boolean | null
          pro_audio_sessions_used?: number
          pro_cancel_at_period_end?: boolean | null
          pro_mock_sessions_used?: number
          pro_quick_prep_sessions_used?: number
          pro_session_reset_date?: string | null
          pro_subscription_end?: string | null
          pro_subscription_start?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      session_results: {
        Row: {
          created_at: string
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          improvements: Json | null
          overall_score: number | null
          recommendations: string | null
          session_id: string
          strengths: Json | null
        }
        Insert: {
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          improvements?: Json | null
          overall_score?: number | null
          recommendations?: string | null
          session_id: string
          strengths?: Json | null
        }
        Update: {
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          improvements?: Json | null
          overall_score?: number | null
          recommendations?: string | null
          session_id?: string
          strengths?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "session_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      welcome_emails_sent: {
        Row: {
          checkout_session_id: string
          email: string
          id: string
          sent_at: string | null
        }
        Insert: {
          checkout_session_id: string
          email: string
          id?: string
          sent_at?: string | null
        }
        Update: {
          checkout_session_id?: string
          email?: string
          id?: string
          sent_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atomic_check_and_increment_session: {
        Args: { p_email: string; p_session_type: string }
        Returns: Json
      }
      get_secret_from_vault: { Args: { secret_name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      session_status: "pending" | "active" | "completed" | "cancelled"
      session_type: "quick_prep" | "full_mock" | "premium_audio" | "pro"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      session_status: ["pending", "active", "completed", "cancelled"],
      session_type: ["quick_prep", "full_mock", "premium_audio", "pro"],
    },
  },
} as const
