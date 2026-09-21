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
      abandoned_checkouts: {
        Row: {
          cart_data: Json
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          recovered_at: string | null
          status: string
          subtotal: number
        }
        Insert: {
          cart_data?: Json
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          recovered_at?: string | null
          status?: string
          subtotal?: number
        }
        Update: {
          cart_data?: Json
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          recovered_at?: string | null
          status?: string
          subtotal?: number
        }
        Relationships: []
      }
      acc_accounts: {
        Row: {
          balance: number
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      acc_activity_logs: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      acc_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          marked_by: string | null
          note: string | null
          person_id: string
          status: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          person_id: string
          status?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          person_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_investments: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          source: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          source?: string
        }
        Relationships: []
      }
      acc_loan_payments: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          id: string
          loan_id: string
          note: string | null
          payment_date: string
          payment_source: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          loan_id: string
          note?: string | null
          payment_date?: string
          payment_source?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          note?: string | null
          payment_date?: string
          payment_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_loan_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "acc_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "acc_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_loans: {
        Row: {
          created_at: string
          deposit_account_id: string | null
          id: string
          interest_rate: number
          interest_type: string
          lender_name: string | null
          loan_type: string
          monthly_installment: number
          monthly_interest_amount: number
          name: string
          principal_amount: number
          start_date: string
          status: string
          total_installments: number
          tracking_start_date: string | null
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          deposit_account_id?: string | null
          id?: string
          interest_rate?: number
          interest_type?: string
          lender_name?: string | null
          loan_type?: string
          monthly_installment?: number
          monthly_interest_amount?: number
          name: string
          principal_amount?: number
          start_date?: string
          status?: string
          total_installments?: number
          tracking_start_date?: string | null
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          deposit_account_id?: string | null
          id?: string
          interest_rate?: number
          interest_type?: string
          lender_name?: string | null
          loan_type?: string
          monthly_installment?: number
          monthly_interest_amount?: number
          name?: string
          principal_amount?: number
          start_date?: string
          status?: string
          total_installments?: number
          tracking_start_date?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_loans_deposit_account_id_fkey"
            columns: ["deposit_account_id"]
            isOneToOne: false
            referencedRelation: "acc_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_loans_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_off_days: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          person_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          person_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_off_days_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_party_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          is_submission: boolean
          memo_number: string | null
          person_id: string
          product_name: string
          quantity: number | null
          rate: number | null
          total: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          is_submission?: boolean
          memo_number?: string | null
          person_id: string
          product_name: string
          quantity?: number | null
          rate?: number | null
          total?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_submission?: boolean
          memo_number?: string | null
          person_id?: string
          product_name?: string
          quantity?: number | null
          rate?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_party_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_persons: {
        Row: {
          base_salary: number | null
          created_at: string
          duty_end: string | null
          duty_start: string | null
          id: string
          is_active: boolean
          joining_date: string | null
          linked_loan_id: string | null
          name: string
          person_code: string | null
          phone: string | null
          resigned_at: string | null
          salary_type: string
          type: string
          unit_id: string | null
        }
        Insert: {
          base_salary?: number | null
          created_at?: string
          duty_end?: string | null
          duty_start?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string | null
          linked_loan_id?: string | null
          name: string
          person_code?: string | null
          phone?: string | null
          resigned_at?: string | null
          salary_type?: string
          type?: string
          unit_id?: string | null
        }
        Update: {
          base_salary?: number | null
          created_at?: string
          duty_end?: string | null
          duty_start?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string | null
          linked_loan_id?: string | null
          name?: string
          person_code?: string | null
          phone?: string | null
          resigned_at?: string | null
          salary_type?: string
          type?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_persons_linked_loan_id_fkey"
            columns: ["linked_loan_id"]
            isOneToOne: false
            referencedRelation: "acc_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_persons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_production_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          is_submission: boolean
          order_number: string | null
          order_total_quantity: number | null
          person_id: string
          pricing: number | null
          product_name: string
          quantity: number | null
          total: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          is_submission?: boolean
          order_number?: string | null
          order_total_quantity?: number | null
          person_id: string
          pricing?: number | null
          product_name: string
          quantity?: number | null
          total?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_submission?: boolean
          order_number?: string | null
          order_total_quantity?: number | null
          person_id?: string
          pricing?: number | null
          product_name?: string
          quantity?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_production_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_production_payments: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          person_id: string
          transaction_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          person_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          person_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_production_payments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_production_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "acc_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_salary_config: {
        Row: {
          base_salary: number
          created_at: string
          effective_from: string
          id: string
          off_days_per_week: Json
          person_id: string
        }
        Insert: {
          base_salary?: number
          created_at?: string
          effective_from?: string
          id?: string
          off_days_per_week?: Json
          person_id: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          effective_from?: string
          id?: string
          off_days_per_week?: Json
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_salary_config_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_salary_increments: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          new_salary: number
          note: string | null
          old_salary: number
          person_id: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          new_salary?: number
          note?: string | null
          old_salary?: number
          person_id: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          new_salary?: number
          note?: string | null
          old_salary?: number
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_salary_increments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_salary_records: {
        Row: {
          absent_days: number
          advance_amount: number
          advance_note: string | null
          base_salary: number
          bonus_amount: number
          bonus_note: string | null
          created_at: string
          deduction: number
          final_salary: number
          id: string
          is_paid: boolean
          month: number
          off_days: number
          overtime_amount: number
          overtime_note: string | null
          paid_amount: number
          paid_at: string | null
          person_id: string
          present_days: number
          received_amount: number
          received_note: string | null
          transaction_id: string | null
          working_days: number
          year: number
        }
        Insert: {
          absent_days?: number
          advance_amount?: number
          advance_note?: string | null
          base_salary?: number
          bonus_amount?: number
          bonus_note?: string | null
          created_at?: string
          deduction?: number
          final_salary?: number
          id?: string
          is_paid?: boolean
          month: number
          off_days?: number
          overtime_amount?: number
          overtime_note?: string | null
          paid_amount?: number
          paid_at?: string | null
          person_id: string
          present_days?: number
          received_amount?: number
          received_note?: string | null
          transaction_id?: string | null
          working_days?: number
          year: number
        }
        Update: {
          absent_days?: number
          advance_amount?: number
          advance_note?: string | null
          base_salary?: number
          bonus_amount?: number
          bonus_note?: string | null
          created_at?: string
          deduction?: number
          final_salary?: number
          id?: string
          is_paid?: boolean
          month?: number
          off_days?: number
          overtime_amount?: number
          overtime_note?: string | null
          paid_amount?: number
          paid_at?: string | null
          person_id?: string
          present_days?: number
          received_amount?: number
          received_note?: string | null
          transaction_id?: string | null
          working_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_salary_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_salary_records_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "acc_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_snapshot_loan_dues: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_id: string | null
          loan_name: string
          snapshot_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string | null
          loan_name: string
          snapshot_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string | null
          loan_name?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_snapshot_loan_dues_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "acc_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_snapshot_loan_dues_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "acc_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_snapshot_party_dues: {
        Row: {
          amount: number
          created_at: string
          id: string
          party_name: string
          person_id: string | null
          snapshot_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          party_name: string
          person_id?: string | null
          snapshot_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          party_name?: string
          person_id?: string | null
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_snapshot_party_dues_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_snapshot_party_dues_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "acc_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_snapshot_stock_items: {
        Row: {
          created_at: string
          id: string
          product_name: string
          quantity: number
          snapshot_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          quantity?: number
          snapshot_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          quantity?: number
          snapshot_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_snapshot_stock_items_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "acc_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_snapshots: {
        Row: {
          bank_amount: number
          cash_amount: number
          created_at: string
          id: string
          label: string
          notes: string | null
          snapshot_date: string
        }
        Insert: {
          bank_amount?: number
          cash_amount?: number
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          snapshot_date: string
        }
        Update: {
          bank_amount?: number
          cash_amount?: number
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          snapshot_date?: string
        }
        Relationships: []
      }
      acc_transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          person_id: string | null
          reference_id: string | null
          reference_type: string | null
          source: string | null
          type: string
          unit_id: string | null
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          person_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          type: string
          unit_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          person_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          type?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "acc_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_unit_custom_expenses: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          id: string
          item_name: string
          metadata: Json | null
          module_name: string
          unit_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          item_name: string
          metadata?: Json | null
          module_name: string
          unit_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          item_name?: string
          metadata?: Json | null
          module_name?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_unit_custom_expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_unit_fixed_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          month: number
          unit_id: string
          year: number
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          month: number
          unit_id: string
          year: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          month?: number
          unit_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_unit_fixed_expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_unit_materials: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          item_name: string
          quantity: number | null
          total: number
          unit_id: string
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          item_name: string
          quantity?: number | null
          total?: number
          unit_id: string
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          item_name?: string
          quantity?: number | null
          total?: number
          unit_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_unit_materials_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_unit_rent_increments: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          new_amount: number
          note: string | null
          old_amount: number
          unit_id: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          new_amount?: number
          note?: string | null
          old_amount?: number
          unit_id: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          new_amount?: number
          note?: string | null
          old_amount?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_unit_rent_increments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_unit_rent_payments: {
        Row: {
          account_id: string | null
          allocations: Json
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_date: string
          source: string
          unit_id: string
        }
        Insert: {
          account_id?: string | null
          allocations?: Json
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_date?: string
          source?: string
          unit_id: string
        }
        Update: {
          account_id?: string | null
          allocations?: Json
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_date?: string
          source?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_unit_rent_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "acc_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_unit_rent_payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_unit_rent_records: {
        Row: {
          created_at: string
          id: string
          is_paid: boolean
          month: number
          paid_amount: number
          rent_amount: number
          unit_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_paid?: boolean
          month: number
          paid_amount?: number
          rent_amount?: number
          unit_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_paid?: boolean
          month?: number
          paid_amount?: number
          rent_amount?: number
          unit_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_unit_rent_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_units: {
        Row: {
          allowed_types: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
          settings: Json
        }
        Insert: {
          allowed_types?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          settings?: Json
        }
        Update: {
          allowed_types?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json
        }
        Relationships: []
      }
      acc_work_order_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          person_id: string
          quantity: number
          rate: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          person_id: string
          quantity?: number
          rate?: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          person_id?: string
          quantity?: number
          rate?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_work_order_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "acc_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_work_order_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "acc_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_work_orders: {
        Row: {
          created_at: string
          id: string
          order_number: string
          pricing: number
          product_name: string
          status: string
          total_quantity: number
          unit_id: string
          wage: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_number: string
          pricing?: number
          product_name: string
          status?: string
          total_quantity?: number
          unit_id: string
          wage?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_number?: string
          pricing?: number
          product_name?: string
          status?: string
          total_quantity?: number
          unit_id?: string
          wage?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "acc_units"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          reference_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          reference_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      ai_knowledge_base: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          priority: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_landing_generations: {
        Row: {
          created_at: string
          created_by: string | null
          duration_ms: number | null
          error: string | null
          id: string
          input_context: Json
          landing_page_id: string | null
          model: string
          output_layout: Json
          product_ids: string[]
          prompt_version: string
          status: string
          style_preset: string | null
          tokens_in: number | null
          tokens_out: number | null
          tone: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_context?: Json
          landing_page_id?: string | null
          model?: string
          output_layout?: Json
          product_ids?: string[]
          prompt_version?: string
          status?: string
          style_preset?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tone?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_context?: Json
          landing_page_id?: string | null
          model?: string
          output_layout?: Json
          product_ids?: string[]
          prompt_version?: string
          status?: string
          style_preset?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_landing_generations_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_landing_presets: {
        Row: {
          created_at: string
          default_colors: Json
          default_typography: Json
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          section_blueprint: Json
          sort_order: number
          system_prompt_addendum: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_colors?: Json
          default_typography?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          section_blueprint?: Json
          sort_order?: number
          system_prompt_addendum?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_colors?: Json
          default_typography?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          section_blueprint?: Json
          sort_order?: number
          system_prompt_addendum?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_support_requests: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          status: string
          visitor_name: string
          visitor_phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
          visitor_name?: string
          visitor_phone?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
          visitor_name?: string
          visitor_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_support_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_image_url: string | null
          banner_tagline: string | null
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_bn: string
          parent_id: string | null
          shop_banner_tagline: string | null
          shop_banner_url: string | null
          slug: string
        }
        Insert: {
          banner_image_url?: string | null
          banner_tagline?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_bn?: string
          parent_id?: string | null
          shop_banner_tagline?: string | null
          shop_banner_url?: string | null
          slug: string
        }
        Update: {
          banner_image_url?: string | null
          banner_tagline?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_bn?: string
          parent_id?: string | null
          shop_banner_tagline?: string | null
          shop_banner_url?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_calls: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          callee_ice: Json | null
          callee_signal: Json | null
          caller_ice: Json | null
          caller_name: string
          caller_phone: string
          caller_signal: Json | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          initiated_at: string
          session_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          callee_ice?: Json | null
          callee_signal?: Json | null
          caller_ice?: Json | null
          caller_name?: string
          caller_phone?: string
          caller_signal?: Json | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiated_at?: string
          session_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          callee_ice?: Json | null
          callee_signal?: Json | null
          caller_ice?: Json | null
          caller_name?: string
          caller_phone?: string
          caller_signal?: Json | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiated_at?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean
          message: string
          metadata: Json | null
          sender_avatar: string | null
          sender_id: string | null
          sender_name: string
          sender_type: string
          session_id: string
          voice_duration_ms: number | null
          voice_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string
          metadata?: Json | null
          sender_avatar?: string | null
          sender_id?: string | null
          sender_name?: string
          sender_type?: string
          session_id: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string
          metadata?: Json | null
          sender_avatar?: string | null
          sender_id?: string | null
          sender_name?: string
          sender_type?: string
          session_id?: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_user_id: string | null
          id: string
          last_message_at: string
          session_token: string
          status: string
          unread_count: number
          visitor_name: string
          visitor_phone: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          last_message_at?: string
          session_token?: string
          status?: string
          unread_count?: number
          visitor_name?: string
          visitor_phone?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_user_id?: string | null
          id?: string
          last_message_at?: string
          session_token?: string
          status?: string
          unread_count?: number
          visitor_name?: string
          visitor_phone?: string
        }
        Relationships: []
      }
      conversions_sent: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          error: string | null
          event_id: string
          event_name: string
          id: string
          order_id: string
          request_payload: Json | null
          response_body: Json | null
          sent_at: string | null
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string
          error?: string | null
          event_id: string
          event_name: string
          id?: string
          order_id: string
          request_payload?: Json | null
          response_body?: Json | null
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          error?: string | null
          event_id?: string
          event_name?: string
          id?: string
          order_id?: string
          request_payload?: Json | null
          response_body?: Json | null
          sent_at?: string | null
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversions_sent_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_uses: number | null
          min_order_amount: number
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      courier_payments: {
        Row: {
          bank_amount: number | null
          cash_amount: number | null
          cod_charge: number
          collected_amount: number
          courier_provider: string
          created_at: string
          date: string
          delivery_bill: number
          id: string
          invoice_number: string
          receivable_amount: number
          receive_method: string | null
          status: string
          sub_total: number
        }
        Insert: {
          bank_amount?: number | null
          cash_amount?: number | null
          cod_charge?: number
          collected_amount?: number
          courier_provider?: string
          created_at?: string
          date?: string
          delivery_bill?: number
          id?: string
          invoice_number?: string
          receivable_amount?: number
          receive_method?: string | null
          status?: string
          sub_total?: number
        }
        Update: {
          bank_amount?: number | null
          cash_amount?: number | null
          cod_charge?: number
          collected_amount?: number
          courier_provider?: string
          created_at?: string
          date?: string
          delivery_bill?: number
          id?: string
          invoice_number?: string
          receivable_amount?: number
          receive_method?: string | null
          status?: string
          sub_total?: number
        }
        Relationships: []
      }
      courier_tracking_events: {
        Row: {
          consignment_id: string | null
          created_at: string
          hub_name: string | null
          hub_phone: string | null
          id: string
          note: string | null
          order_id: string
          raw_data: Json | null
          rider_name: string | null
          rider_phone: string | null
          status: string | null
        }
        Insert: {
          consignment_id?: string | null
          created_at?: string
          hub_name?: string | null
          hub_phone?: string | null
          id?: string
          note?: string | null
          order_id: string
          raw_data?: Json | null
          rider_name?: string | null
          rider_phone?: string | null
          status?: string | null
        }
        Update: {
          consignment_id?: string | null
          created_at?: string
          hub_name?: string | null
          hub_phone?: string | null
          id?: string
          note?: string | null
          order_id?: string
          raw_data?: Json | null
          rider_name?: string | null
          rider_phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_tracking_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      crm_customer_tags: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_customer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_saved_audiences: {
        Row: {
          category: string | null
          channel_hint: string | null
          created_at: string
          created_by: string | null
          customer_count: number
          description: string | null
          filters: Json
          id: string
          is_favorite: boolean
          last_used_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          channel_hint?: string | null
          created_at?: string
          created_by?: string | null
          customer_count?: number
          description?: string | null
          filters?: Json
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          channel_hint?: string | null
          created_at?: string
          created_by?: string | null
          customer_count?: number
          description?: string | null
          filters?: Json
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_tags: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_reviews: {
        Row: {
          created_at: string
          customer_location: string | null
          customer_name: string
          customer_user_id: string | null
          id: string
          images: string[] | null
          order_id: string | null
          product_id: string | null
          product_name: string | null
          rating: number
          review_text: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_location?: string | null
          customer_name: string
          customer_user_id?: string | null
          id?: string
          images?: string[] | null
          order_id?: string | null
          product_id?: string | null
          product_name?: string | null
          rating?: number
          review_text?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_location?: string | null
          customer_name?: string
          customer_user_id?: string | null
          id?: string
          images?: string[] | null
          order_id?: string | null
          product_id?: string | null
          product_name?: string | null
          rating?: number
          review_text?: string | null
          status?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          courier_checked_at: string | null
          courier_data: Json | null
          created_at: string
          delivered_orders: number
          id: string
          last_order_date: string | null
          name: string
          phone: string
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          courier_checked_at?: string | null
          courier_data?: Json | null
          created_at?: string
          delivered_orders?: number
          id?: string
          last_order_date?: string | null
          name?: string
          phone: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          courier_checked_at?: string | null
          courier_data?: Json | null
          created_at?: string
          delivered_orders?: number
          id?: string
          last_order_date?: string | null
          name?: string
          phone?: string
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          created_at: string
          failed_count: number
          html_body: string
          id: string
          recipient_count: number
          segment_filter: Json
          sent_count: number
          subject: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          html_body?: string
          id?: string
          recipient_count?: number
          segment_filter?: Json
          sent_count?: number
          subject?: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          html_body?: string
          id?: string
          recipient_count?: number
          segment_filter?: Json
          sent_count?: number
          subject?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          channel: string
          created_at: string | null
          html_content: string
          id: string
          is_active: boolean | null
          sms_content: string
          subject: string
          template_key: string
          updated_at: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          sms_content?: string
          subject: string
          template_key: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          sms_content?: string
          subject?: string
          template_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          duty_end_time: string | null
          duty_start_time: string | null
          full_name: string
          gender: string | null
          hobbies: string[] | null
          id: string
          is_active: boolean
          off_day: string | null
          phone: string | null
          saved_quotes: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          duty_end_time?: string | null
          duty_start_time?: string | null
          full_name?: string
          gender?: string | null
          hobbies?: string[] | null
          id?: string
          is_active?: boolean
          off_day?: string | null
          phone?: string | null
          saved_quotes?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          duty_end_time?: string | null
          duty_start_time?: string | null
          full_name?: string
          gender?: string | null
          hobbies?: string[] | null
          id?: string
          is_active?: boolean
          off_day?: string | null
          phone?: string | null
          saved_quotes?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      free_shipping_campaign_stats: {
        Row: {
          campaign_id: string
          free_shipping_cost: number
          last_recomputed_at: string
          orders_count: number
          revenue: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          free_shipping_cost?: number
          last_recomputed_at?: string
          orders_count?: number
          revenue?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          free_shipping_cost?: number
          last_recomputed_at?: string
          orders_count?: number
          revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_shipping_campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "free_shipping_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      free_shipping_campaigns: {
        Row: {
          applicable_category_ids: string[]
          applicable_product_ids: string[]
          banner_image: string | null
          combine_logic: string
          coupon_code: string | null
          created_at: string
          description: string | null
          end_date: string | null
          excluded_product_ids: string[]
          id: string
          max_amount: number | null
          max_quantity: number | null
          min_amount: number | null
          min_quantity: number | null
          name: string
          priority: number
          rule_type: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applicable_category_ids?: string[]
          applicable_product_ids?: string[]
          banner_image?: string | null
          combine_logic?: string
          coupon_code?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          excluded_product_ids?: string[]
          id?: string
          max_amount?: number | null
          max_quantity?: number | null
          min_amount?: number | null
          min_quantity?: number | null
          name: string
          priority?: number
          rule_type?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicable_category_ids?: string[]
          applicable_product_ids?: string[]
          banner_image?: string | null
          combine_logic?: string
          coupon_code?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          excluded_product_ids?: string[]
          id?: string
          max_amount?: number | null
          max_quantity?: number | null
          min_amount?: number | null
          min_quantity?: number | null
          name?: string
          priority?: number
          rule_type?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      giveaway_entries: {
        Row: {
          created_at: string
          customer_name: string
          gift_number: number
          id: string
          order_id: string | null
          packaging_image: string | null
          product_name: string
          profile_link: string | null
          profile_screenshot: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string
          gift_number?: number
          id?: string
          order_id?: string | null
          packaging_image?: string | null
          product_name?: string
          profile_link?: string | null
          profile_screenshot?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          gift_number?: number
          id?: string
          order_id?: string | null
          packaging_image?: string | null
          product_name?: string
          profile_link?: string | null
          profile_screenshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      global_colors: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      global_sizes: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      inbox_ai_cache: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          kind: string
          last_message_id: string | null
          payload: Json
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          kind: string
          last_message_id?: string | null
          payload?: Json
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          last_message_id?: string | null
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "inbox_ai_cache_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_automation_logs: {
        Row: {
          conversation_id: string
          created_at: string
          event: string
          id: string
          message_id: string | null
          payload: Json
          rule_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          event: string
          id?: string
          message_id?: string | null
          payload?: Json
          rule_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          event?: string
          id?: string
          message_id?: string | null
          payload?: Json
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_automation_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_automation_rules: {
        Row: {
          action: string
          created_at: string
          id: string
          is_active: boolean
          match_keywords: string[]
          match_pattern: string | null
          name: string
          priority: number
          reply_lang: string
          reply_template: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_keywords?: string[]
          match_pattern?: string | null
          name: string
          priority?: number
          reply_lang?: string
          reply_template?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_keywords?: string[]
          match_pattern?: string | null
          name?: string
          priority?: number
          reply_lang?: string
          reply_template?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inbox_broadcast_campaigns: {
        Row: {
          audience_filter: Json
          audience_size: number
          created_at: string
          created_by: string | null
          delivered_count: number
          id: string
          media_url: string | null
          message: string
          name: string
          opened_count: number
          platform: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
        }
        Insert: {
          audience_filter?: Json
          audience_size?: number
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          id?: string
          media_url?: string | null
          message?: string
          name: string
          opened_count?: number
          platform?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
        }
        Update: {
          audience_filter?: Json
          audience_size?: number
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          id?: string
          media_url?: string | null
          message?: string
          name?: string
          opened_count?: number
          platform?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      inbox_broadcast_recipients: {
        Row: {
          campaign_id: string
          conversation_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          simulated_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          conversation_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          simulated_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          simulated_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "inbox_broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_avatar: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          last_intent_message_id: string | null
          last_message: string | null
          last_message_at: string
          lead_score: string | null
          metadata: Json | null
          platform: string
          platform_conversation_id: string | null
          sla_breached: boolean
          sla_due_at: string | null
          sla_first_response_at: string | null
          sla_last_agent_reply_at: string | null
          status: string
          tags: string[] | null
          unread_count: number
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_avatar?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          last_intent_message_id?: string | null
          last_message?: string | null
          last_message_at?: string
          lead_score?: string | null
          metadata?: Json | null
          platform?: string
          platform_conversation_id?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          sla_first_response_at?: string | null
          sla_last_agent_reply_at?: string | null
          status?: string
          tags?: string[] | null
          unread_count?: number
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_avatar?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          last_intent_message_id?: string | null
          last_message?: string | null
          last_message_at?: string
          lead_score?: string | null
          metadata?: Json | null
          platform?: string
          platform_conversation_id?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          sla_first_response_at?: string | null
          sla_last_agent_reply_at?: string | null
          status?: string
          tags?: string[] | null
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "inbox_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_customer_attributes: {
        Row: {
          attrs: Json
          conversation_id: string
          customer_phone: string | null
          id: string
          updated_at: string
        }
        Insert: {
          attrs?: Json
          conversation_id: string
          customer_phone?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          attrs?: Json
          conversation_id?: string
          customer_phone?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_customer_attributes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_customer_notes: {
        Row: {
          author_id: string | null
          conversation_id: string
          created_at: string
          customer_phone: string | null
          id: string
          note: string
        }
        Insert: {
          author_id?: string | null
          conversation_id: string
          created_at?: string
          customer_phone?: string | null
          id?: string
          note: string
        }
        Update: {
          author_id?: string | null
          conversation_id?: string
          created_at?: string
          customer_phone?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_customer_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_detected_orders: {
        Row: {
          conversation_id: string
          created_at: string
          currency: string
          customer_phone: string | null
          detected_price: number | null
          id: string
          linked_order_id: string | null
          message_id: string | null
          metadata: Json
          product_hint: string | null
          raw_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          currency?: string
          customer_phone?: string | null
          detected_price?: number | null
          id?: string
          linked_order_id?: string | null
          message_id?: string | null
          metadata?: Json
          product_hint?: string | null
          raw_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          currency?: string
          customer_phone?: string | null
          detected_price?: number | null
          id?: string
          linked_order_id?: string | null
          message_id?: string | null
          metadata?: Json
          product_hint?: string | null
          raw_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_detected_orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_followups: {
        Row: {
          conversation_id: string
          created_at: string
          due_at: string
          id: string
          last_message_id: string | null
          sent_message_id: string | null
          status: string
          step: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          due_at: string
          id?: string
          last_message_id?: string | null
          sent_message_id?: string | null
          status?: string
          step: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          due_at?: string
          id?: string
          last_message_id?: string | null
          sent_message_id?: string | null
          status?: string
          step?: string
        }
        Relationships: []
      }
      inbox_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean
          message: string | null
          metadata: Json | null
          provider_message_id: string | null
          sender_name: string
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          sender_name?: string
          sender_type?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          sender_name?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "inbox_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_quick_replies: {
        Row: {
          category: string | null
          created_at: string
          id: string
          message: string
          shortcut: string | null
          sort_order: number | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          shortcut?: string | null
          sort_order?: number | null
          title?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          shortcut?: string | null
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      inbox_simulated_calls: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string | null
          customer_phone: string
          id: string
          linked_order_id: string | null
          outcome: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by?: string | null
          customer_phone?: string
          id?: string
          linked_order_id?: string | null
          outcome?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          customer_phone?: string
          id?: string
          linked_order_id?: string | null
          outcome?: string
        }
        Relationships: []
      }
      integration_assets: {
        Row: {
          access_token: string | null
          asset_id: string
          asset_type: string
          created_at: string
          display_name: string | null
          health_detail: Json | null
          health_status: string
          id: string
          last_health_check_at: string | null
          parent_id: string | null
          platform: string
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
          webhook_subscribed: boolean
        }
        Insert: {
          access_token?: string | null
          asset_id: string
          asset_type: string
          created_at?: string
          display_name?: string | null
          health_detail?: Json | null
          health_status?: string
          id?: string
          last_health_check_at?: string | null
          parent_id?: string | null
          platform: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          webhook_subscribed?: boolean
        }
        Update: {
          access_token?: string | null
          asset_id?: string
          asset_type?: string
          created_at?: string
          display_name?: string | null
          health_detail?: Json | null
          health_status?: string
          id?: string
          last_health_check_at?: string | null
          parent_id?: string | null
          platform?: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          webhook_subscribed?: boolean
        }
        Relationships: []
      }
      landing_page_products: {
        Row: {
          id: string
          landing_page_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          landing_page_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          landing_page_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_products_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_sections: {
        Row: {
          ai_meta: Json | null
          content: Json
          created_at: string
          id: string
          is_active: boolean
          landing_page_id: string
          section_type: string
          sort_order: number
        }
        Insert: {
          ai_meta?: Json | null
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          landing_page_id: string
          section_type?: string
          sort_order?: number
        }
        Update: {
          ai_meta?: Json | null
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          landing_page_id?: string
          section_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_sections_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          created_at: string
          facebook_pixel_id: string | null
          id: string
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          page_config: Json
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          facebook_pixel_id?: string | null
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          page_config?: Json
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          facebook_pixel_id?: string | null
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          page_config?: Json
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_presence: {
        Row: {
          last_seen: string
          session_id: string
        }
        Insert: {
          last_seen?: string
          session_id: string
        }
        Update: {
          last_seen?: string
          session_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          message_content: string | null
          notification_type: string
          order_id: string | null
          recipient: string | null
          status: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          notification_type: string
          order_id?: string | null
          recipient?: string | null
          status?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          notification_type?: string
          order_id?: string | null
          recipient?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_courier_parcels: {
        Row: {
          archived_at: string | null
          cod_amount: number | null
          consignment_id: string | null
          courier_name: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          order_id: string
          raw_response: Json | null
          reason: string | null
          status: string | null
          tracking_code: string | null
        }
        Insert: {
          archived_at?: string | null
          cod_amount?: number | null
          consignment_id?: string | null
          courier_name?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          order_id: string
          raw_response?: Json | null
          reason?: string | null
          status?: string | null
          tracking_code?: string | null
        }
        Update: {
          archived_at?: string | null
          cod_amount?: number | null
          consignment_id?: string | null
          courier_name?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          order_id?: string
          raw_response?: Json | null
          reason?: string | null
          status?: string | null
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_courier_parcels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_exchanges: {
        Row: {
          created_at: string
          created_by: string | null
          customer_owes: number
          exchange_type: string
          extra_delivery_charge: number
          id: string
          new_items: Json
          new_order_id: string | null
          new_total: number
          note: string | null
          old_items: Json
          old_total: number
          order_id: string
          price_difference: number
          status: string
          store_owes: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_owes?: number
          exchange_type: string
          extra_delivery_charge?: number
          id?: string
          new_items?: Json
          new_order_id?: string | null
          new_total?: number
          note?: string | null
          old_items?: Json
          old_total?: number
          order_id: string
          price_difference?: number
          status?: string
          store_owes?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_owes?: number
          exchange_type?: string
          extra_delivery_charge?: number
          id?: string
          new_items?: Json
          new_order_id?: string | null
          new_total?: number
          note?: string | null
          old_items?: Json
          old_total?: number
          order_id?: string
          price_difference?: number
          status?: string
          store_owes?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_exchanges_new_order_id_fkey"
            columns: ["new_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exchanges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string | null
          id: string
          item_type: string
          order_id: string
          parent_product_id: string | null
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          size: string | null
          upsell_image: string | null
          upsell_parent_name: string | null
        }
        Insert: {
          color?: string | null
          id?: string
          item_type?: string
          order_id: string
          parent_product_id?: string | null
          price?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          size?: string | null
          upsell_image?: string | null
          upsell_parent_name?: string | null
        }
        Update: {
          color?: string | null
          id?: string
          item_type?: string
          order_id?: string
          parent_product_id?: string | null
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
          upsell_image?: string | null
          upsell_parent_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          city: string
          client_ip: string | null
          consent_snapshot: Json | null
          courier_consignment_id: string | null
          courier_entry_date: string | null
          courier_last_synced_total: number | null
          courier_manual_name: string | null
          courier_note: string | null
          courier_previous_consignment_ids: Json
          courier_provider: string | null
          courier_status: string | null
          courier_tracking_code: string | null
          created_at: string
          customer_address: string
          customer_alt_phone: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          deleted_at: string | null
          delivery_area: string
          delivery_charge: number
          discount_note: string | null
          due_amount: number | null
          event_source_url: string | null
          fbc: string | null
          fbp: string | null
          free_shipping: boolean | null
          ga_client_id: string | null
          ga_session_id: string | null
          gbraid: string | null
          gclid: string | null
          id: string
          is_gift_order: boolean
          is_pre_order: boolean
          memo_token: string | null
          notes: string | null
          order_attribution: Json
          order_number: string
          order_origin: string
          paid_amount: number | null
          paid_at: string | null
          payment_invoice_id: string | null
          payment_method: string
          payment_status: string
          return_pending: boolean
          return_received_at: string | null
          return_received_by: string | null
          scheduled_dispatch_date: string | null
          source_landing_page_id: string | null
          status: string
          status_note: string | null
          subtotal: number
          total: number
          user_agent: string | null
          wbraid: string | null
        }
        Insert: {
          city?: string
          client_ip?: string | null
          consent_snapshot?: Json | null
          courier_consignment_id?: string | null
          courier_entry_date?: string | null
          courier_last_synced_total?: number | null
          courier_manual_name?: string | null
          courier_note?: string | null
          courier_previous_consignment_ids?: Json
          courier_provider?: string | null
          courier_status?: string | null
          courier_tracking_code?: string | null
          created_at?: string
          customer_address: string
          customer_alt_phone?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_user_id?: string | null
          deleted_at?: string | null
          delivery_area?: string
          delivery_charge?: number
          discount_note?: string | null
          due_amount?: number | null
          event_source_url?: string | null
          fbc?: string | null
          fbp?: string | null
          free_shipping?: boolean | null
          ga_client_id?: string | null
          ga_session_id?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          is_gift_order?: boolean
          is_pre_order?: boolean
          memo_token?: string | null
          notes?: string | null
          order_attribution?: Json
          order_number?: string
          order_origin?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_invoice_id?: string | null
          payment_method?: string
          payment_status?: string
          return_pending?: boolean
          return_received_at?: string | null
          return_received_by?: string | null
          scheduled_dispatch_date?: string | null
          source_landing_page_id?: string | null
          status?: string
          status_note?: string | null
          subtotal?: number
          total?: number
          user_agent?: string | null
          wbraid?: string | null
        }
        Update: {
          city?: string
          client_ip?: string | null
          consent_snapshot?: Json | null
          courier_consignment_id?: string | null
          courier_entry_date?: string | null
          courier_last_synced_total?: number | null
          courier_manual_name?: string | null
          courier_note?: string | null
          courier_previous_consignment_ids?: Json
          courier_provider?: string | null
          courier_status?: string | null
          courier_tracking_code?: string | null
          created_at?: string
          customer_address?: string
          customer_alt_phone?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          deleted_at?: string | null
          delivery_area?: string
          delivery_charge?: number
          discount_note?: string | null
          due_amount?: number | null
          event_source_url?: string | null
          fbc?: string | null
          fbp?: string | null
          free_shipping?: boolean | null
          ga_client_id?: string | null
          ga_session_id?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          is_gift_order?: boolean
          is_pre_order?: boolean
          memo_token?: string | null
          notes?: string | null
          order_attribution?: Json
          order_number?: string
          order_origin?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_invoice_id?: string | null
          payment_method?: string
          payment_status?: string
          return_pending?: boolean
          return_received_at?: string | null
          return_received_by?: string | null
          scheduled_dispatch_date?: string | null
          source_landing_page_id?: string | null
          status?: string
          status_note?: string | null
          subtotal?: number
          total?: number
          user_agent?: string | null
          wbraid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_source_landing_page_id_fkey"
            columns: ["source_landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string | null
          id: string
          page_path: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_path?: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          page_path?: string
          session_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number | null
          created_at: string
          failure_reason: string | null
          gateway: string
          gateway_payment_id: string
          gateway_response: Json | null
          id: string
          order_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          failure_reason?: string | null
          gateway: string
          gateway_payment_id: string
          gateway_response?: Json | null
          id?: string
          order_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          failure_reason?: string | null
          gateway?: string
          gateway_payment_id?: string
          gateway_response?: Json | null
          id?: string
          order_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          created_at: string | null
          id: string
          product_ids: string[]
          slug: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_ids: string[]
          slug: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_ids?: string[]
          slug?: string
          title?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          addon_config: Json | null
          allow_pre_order: boolean
          bump_discount: number
          bump_product_id: string | null
          category_id: string | null
          category_pinned_at: string | null
          clearance_active: boolean
          clearance_price: number | null
          colors: string[] | null
          cost_price: number | null
          created_at: string
          deleted_at: string | null
          description: string
          description_bn: string
          feed_description: string | null
          feed_title: string | null
          id: string
          images: string[] | null
          is_active: boolean
          is_featured: boolean
          is_hidden_from_shop: boolean
          linked_product_ids: string[]
          name: string
          name_bn: string
          original_price: number | null
          price: number
          product_type: string
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          sizes: string[] | null
          slug: string
          stock: number
          suggested_product_ids: string[]
          variant_images: Json
          video_file_url: string | null
          video_url: string | null
        }
        Insert: {
          addon_config?: Json | null
          allow_pre_order?: boolean
          bump_discount?: number
          bump_product_id?: string | null
          category_id?: string | null
          category_pinned_at?: string | null
          clearance_active?: boolean
          clearance_price?: number | null
          colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          description_bn?: string
          feed_description?: string | null
          feed_title?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_featured?: boolean
          is_hidden_from_shop?: boolean
          linked_product_ids?: string[]
          name: string
          name_bn?: string
          original_price?: number | null
          price?: number
          product_type?: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          sizes?: string[] | null
          slug: string
          stock?: number
          suggested_product_ids?: string[]
          variant_images?: Json
          video_file_url?: string | null
          video_url?: string | null
        }
        Update: {
          addon_config?: Json | null
          allow_pre_order?: boolean
          bump_discount?: number
          bump_product_id?: string | null
          category_id?: string | null
          category_pinned_at?: string | null
          clearance_active?: boolean
          clearance_price?: number | null
          colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          description_bn?: string
          feed_description?: string | null
          feed_title?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_featured?: boolean
          is_hidden_from_shop?: boolean
          linked_product_ids?: string[]
          name?: string
          name_bn?: string
          original_price?: number | null
          price?: number
          product_type?: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          sizes?: string[] | null
          slug?: string
          stock?: number
          suggested_product_ids?: string[]
          variant_images?: Json
          video_file_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          created_at: string | null
          id: string
          page_path: string | null
          session_id: string
          source: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_path?: string | null
          session_id: string
          source?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          page_path?: string | null
          session_id?: string
          source?: string | null
        }
        Relationships: []
      }
      sms_campaign_recipients: {
        Row: {
          campaign_id: string
          click_count: number
          click_status: string
          created_at: string
          customer_name: string | null
          error_message: string | null
          final_message: string | null
          id: string
          last_clicked_at: string | null
          message: string
          order_id: string | null
          parts: number
          phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          click_count?: number
          click_status?: string
          created_at?: string
          customer_name?: string | null
          error_message?: string | null
          final_message?: string | null
          id?: string
          last_clicked_at?: string | null
          message: string
          order_id?: string | null
          parts?: number
          phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          click_count?: number
          click_status?: string
          created_at?: string
          customer_name?: string | null
          error_message?: string | null
          final_message?: string | null
          id?: string
          last_clicked_at?: string | null
          message?: string
          order_id?: string | null
          parts?: number
          phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sms_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_campaigns: {
        Row: {
          actual_cost: number | null
          archived_at: string | null
          audience_filter: Json
          audience_filters: Json | null
          audience_id: string | null
          audience_size: number
          audience_source: string | null
          body: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          database_count: number | null
          duplicates_removed: number | null
          excluded_count: number | null
          failed_count: number
          final_body: string | null
          final_count: number | null
          first_click_at: string | null
          first_order_at: string | null
          id: string
          invalid_count: number | null
          last_order_at: string | null
          manual_count: number | null
          name: string
          parent_campaign_id: string | null
          sender_name: string | null
          sent_count: number
          short_link_expires_at: string | null
          snapshot: Json | null
          status: string
          template_name: string | null
          total_cost: number
          total_parts: number
        }
        Insert: {
          actual_cost?: number | null
          archived_at?: string | null
          audience_filter?: Json
          audience_filters?: Json | null
          audience_id?: string | null
          audience_size?: number
          audience_source?: string | null
          body: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          database_count?: number | null
          duplicates_removed?: number | null
          excluded_count?: number | null
          failed_count?: number
          final_body?: string | null
          final_count?: number | null
          first_click_at?: string | null
          first_order_at?: string | null
          id?: string
          invalid_count?: number | null
          last_order_at?: string | null
          manual_count?: number | null
          name: string
          parent_campaign_id?: string | null
          sender_name?: string | null
          sent_count?: number
          short_link_expires_at?: string | null
          snapshot?: Json | null
          status?: string
          template_name?: string | null
          total_cost?: number
          total_parts?: number
        }
        Update: {
          actual_cost?: number | null
          archived_at?: string | null
          audience_filter?: Json
          audience_filters?: Json | null
          audience_id?: string | null
          audience_size?: number
          audience_source?: string | null
          body?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          database_count?: number | null
          duplicates_removed?: number | null
          excluded_count?: number | null
          failed_count?: number
          final_body?: string | null
          final_count?: number | null
          first_click_at?: string | null
          first_order_at?: string | null
          id?: string
          invalid_count?: number | null
          last_order_at?: string | null
          manual_count?: number | null
          name?: string
          parent_campaign_id?: string | null
          sender_name?: string | null
          sent_count?: number
          short_link_expires_at?: string | null
          snapshot?: Json | null
          status?: string
          template_name?: string | null
          total_cost?: number
          total_parts?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaigns_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "crm_saved_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_campaigns_parent_campaign_id_fkey"
            columns: ["parent_campaign_id"]
            isOneToOne: false
            referencedRelation: "sms_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_providers: {
        Row: {
          api_key: string | null
          api_url: string | null
          created_at: string
          id: string
          is_active: boolean
          password: string | null
          provider_name: string
          sender_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          password?: string | null
          provider_name: string
          sender_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          password?: string | null
          provider_name?: string
          sender_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      sms_short_link_clicks: {
        Row: {
          campaign_id: string
          click_key: string | null
          created_at: string
          id: string
          ip: string | null
          is_unique: boolean
          phone: string | null
          recipient_id: string | null
          referer: string | null
          short_link_id: string
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          click_key?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          is_unique?: boolean
          phone?: string | null
          recipient_id?: string | null
          referer?: string | null
          short_link_id: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          click_key?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          is_unique?: boolean
          phone?: string | null
          recipient_id?: string | null
          referer?: string | null
          short_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_short_link_clicks_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "sms_short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_short_links: {
        Row: {
          campaign_id: string
          click_count: number
          created_at: string
          expires_at: string | null
          first_clicked_at: string | null
          id: string
          last_clicked_at: string | null
          original_url: string
          recipient_id: string | null
          token: string
          unique_click_count: number
        }
        Insert: {
          campaign_id: string
          click_count?: number
          created_at?: string
          expires_at?: string | null
          first_clicked_at?: string | null
          id?: string
          last_clicked_at?: string | null
          original_url: string
          recipient_id?: string | null
          token: string
          unique_click_count?: number
        }
        Update: {
          campaign_id?: string
          click_count?: number
          created_at?: string
          expires_at?: string | null
          first_clicked_at?: string | null
          id?: string
          last_clicked_at?: string | null
          original_url?: string
          recipient_id?: string | null
          token?: string
          unique_click_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_short_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sms_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_short_links_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "sms_campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          language: string | null
          name: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string | null
          name: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string | null
          name?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          early_leave_minutes: number
          id: string
          late_minutes: number
          lunch_duration_minutes: number | null
          lunch_end: string | null
          lunch_overtime_minutes: number
          lunch_start: string | null
          overtime_minutes: number
          status: string
          total_working_hours: number | null
          user_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          early_leave_minutes?: number
          id?: string
          late_minutes?: number
          lunch_duration_minutes?: number | null
          lunch_end?: string | null
          lunch_overtime_minutes?: number
          lunch_start?: string | null
          overtime_minutes?: number
          status?: string
          total_working_hours?: number | null
          user_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          early_leave_minutes?: number
          id?: string
          late_minutes?: number
          lunch_duration_minutes?: number | null
          lunch_end?: string | null
          lunch_overtime_minutes?: number
          lunch_start?: string | null
          overtime_minutes?: number
          status?: string
          total_working_hours?: number | null
          user_id?: string
        }
        Relationships: []
      }
      staff_notification_comments: {
        Row: {
          comment: string
          created_at: string
          group_id: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          comment?: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
          user_name?: string
        }
        Update: {
          comment?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      staff_notification_preferences: {
        Row: {
          created_at: string
          id: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_notification_reactions: {
        Row: {
          created_at: string
          emoji: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_notifications: {
        Row: {
          created_at: string | null
          group_id: string | null
          id: string
          is_read: boolean | null
          message: string
          recipient_id: string
          sender_id: string
          sender_name: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          recipient_id: string
          sender_id: string
          sender_name?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          recipient_id?: string
          sender_id?: string
          sender_name?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tracking_consent_events: {
        Row: {
          ad_personalization: string | null
          ad_storage: string | null
          ad_user_data: string | null
          analytics_storage: string | null
          client_ip: string | null
          created_at: string
          id: string
          page_url: string | null
          session_id: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          ad_personalization?: string | null
          ad_storage?: string | null
          ad_user_data?: string | null
          analytics_storage?: string | null
          client_ip?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          ad_personalization?: string | null
          ad_storage?: string | null
          ad_user_data?: string | null
          analytics_storage?: string | null
          client_ip?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitor_activity: {
        Row: {
          activity_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          product_id: string | null
          product_name: string | null
          session_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          product_name?: string | null
          session_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          product_name?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_event_logs: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          has_signature: boolean | null
          id: string
          object_type: string | null
          parsed_count: number
          platform: string
          raw_preview: string | null
          saved_count: number
          skipped_reasons: Json | null
          status_count: number
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string
          has_signature?: boolean | null
          id?: string
          object_type?: string | null
          parsed_count?: number
          platform?: string
          raw_preview?: string | null
          saved_count?: number
          skipped_reasons?: Json | null
          status_count?: number
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          has_signature?: boolean | null
          id?: string
          object_type?: string | null
          parsed_count?: number
          platform?: string
          raw_preview?: string | null
          saved_count?: number
          skipped_reasons?: Json | null
          status_count?: number
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _get_courier_poll_secret: { Args: never; Returns: string }
      _sms_gen_token: { Args: { p_len?: number }; Returns: string }
      _sms_phone_variants: { Args: { p_phone: string }; Returns: string[] }
      accept_voice_call: {
        Args: { p_call_id: string; p_callee_signal: Json }
        Returns: boolean
      }
      apply_gateway_sale_entry: {
        Args: { p_amount: number; p_order_id: string; p_source?: string }
        Returns: undefined
      }
      claim_orders_by_phone: {
        Args: { _phone: string; _user_id: string }
        Returns: number
      }
      create_ai_support_request: {
        Args: {
          p_last_message: string
          p_session_id: string
          p_session_token: string
          p_visitor_name: string
          p_visitor_phone: string
        }
        Returns: string
      }
      create_visitor_chat_session: {
        Args: { p_name: string; p_phone: string }
        Returns: string
      }
      end_call_admin: { Args: { p_call_id: string }; Returns: undefined }
      end_call_visitor: {
        Args: { p_call_id: string; p_session_token: string }
        Returns: undefined
      }
      get_all_product_sales_counts: {
        Args: never
        Returns: {
          product_id: string
          total_sold: number
        }[]
      }
      get_all_product_sales_counts_by_color: {
        Args: never
        Returns: {
          color: string
          product_id: string
          total_sold: number
        }[]
      }
      get_all_product_view_counts: {
        Args: never
        Returns: {
          product_id: string
          total_views: number
        }[]
      }
      get_all_product_view_counts_by_color: {
        Args: never
        Returns: {
          color: string
          product_id: string
          total_views: number
        }[]
      }
      get_available_coupons: { Args: never; Returns: Json }
      get_best_selling_product_ids: {
        Args: { p_limit?: number }
        Returns: {
          product_id: string
          total_sold: number
        }[]
      }
      get_call_state: {
        Args: { p_call_id: string; p_session_token: string }
        Returns: {
          accepted_at: string
          callee_ice: Json
          callee_signal: Json
          caller_ice: Json
          caller_signal: Json
          ended_at: string
          id: string
          status: string
        }[]
      }
      get_category_order_count: {
        Args: { p_product_ids: string[] }
        Returns: number
      }
      get_consent_events: {
        Args: { p_limit?: number }
        Returns: {
          ad_personalization: string | null
          ad_storage: string | null
          ad_user_data: string | null
          analytics_storage: string | null
          client_ip: string | null
          created_at: string
          id: string
          page_url: string | null
          session_id: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tracking_consent_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_conversions_sent: {
        Args: {
          p_channel?: string
          p_limit?: number
          p_order_id?: string
          p_stage?: string
          p_status?: string
        }
        Returns: {
          attempt_count: number
          channel: string
          created_at: string
          error: string | null
          event_id: string
          event_name: string
          id: string
          order_id: string
          request_payload: Json | null
          response_body: Json | null
          sent_at: string | null
          stage: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "conversions_sent"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_customer_auth_info: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
          provider: string
        }[]
      }
      get_customer_showcase: { Args: never; Returns: Json }
      get_customers_recent:
        | { Args: never; Returns: Json }
        | { Args: { p_repeat_only?: boolean }; Returns: Json }
      get_live_visitor_count: { Args: never; Returns: number }
      get_product_cost_prices: {
        Args: { p_ids: string[] }
        Returns: {
          cost_price: number
          id: string
        }[]
      }
      get_product_preorder_counts: {
        Args: never
        Returns: {
          product_id: string
          total_preordered: number
        }[]
      }
      get_public_giveaway_entries: { Args: never; Returns: Json }
      get_recently_used_product_ids: {
        Args: { p_limit?: number }
        Returns: {
          last_used: string
          product_id: string
        }[]
      }
      get_today_best_selling_product_ids: {
        Args: { p_limit?: number }
        Returns: {
          product_id: string
          total_sold: number
        }[]
      }
      get_total_gift_value: { Args: never; Returns: number }
      get_user_chat_session: {
        Args: never
        Returns: {
          id: string
          last_message_at: string
          session_token: string
          visitor_name: string
          visitor_phone: string
        }[]
      }
      get_user_permissions: { Args: { _user_id: string }; Returns: Json }
      get_visitor_chat_messages: {
        Args: {
          p_session_id: string
          p_session_token?: string
          p_visitor_phone?: string
        }
        Returns: {
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean
          message: string
          metadata: Json | null
          sender_avatar: string | null
          sender_id: string | null
          sender_name: string
          sender_type: string
          session_id: string
          voice_duration_ms: number | null
          voice_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initiate_voice_call: {
        Args: {
          p_caller_name: string
          p_caller_phone: string
          p_offer: Json
          p_session_id: string
          p_session_token: string
        }
        Returns: string
      }
      insert_ai_chat_message: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_session_id: string
          p_session_token: string
        }
        Returns: string
      }
      link_chat_session_to_user: {
        Args: { p_session_id: string; p_session_token: string }
        Returns: undefined
      }
      log_call_event: {
        Args: {
          p_call_id: string
          p_event: string
          p_message: string
          p_metadata?: Json
          p_session_id: string
        }
        Returns: string
      }
      map_courier_to_order_status: {
        Args: { _courier_status: string }
        Returns: string
      }
      mark_call_waiting: { Args: { p_call_id: string }; Returns: undefined }
      recompute_customer_stats: {
        Args: { p_phone: string }
        Returns: undefined
      }
      reject_voice_call: { Args: { p_call_id: string }; Returns: undefined }
      send_visitor_chat_message: {
        Args: {
          p_image_url?: string
          p_message: string
          p_sender_name: string
          p_session_id: string
          p_session_token?: string
          p_visitor_phone?: string
        }
        Returns: string
      }
      sms_campaign_report: { Args: { p_campaign_id: string }; Returns: Json }
      sms_duplicate_campaign: { Args: { p_id: string }; Returns: string }
      sms_followup_audience_phones: {
        Args: { p_behavior: string; p_campaign_id: string }
        Returns: string[]
      }
      sms_link_order_from_clicks: {
        Args: { p_click_keys: string[]; p_order_id: string; p_phone: string }
        Returns: number
      }
      sms_record_click: {
        Args: {
          p_click_key: string
          p_ip?: string
          p_referer?: string
          p_token: string
          p_ua?: string
        }
        Returns: Json
      }
      sms_register_short_link: {
        Args: {
          p_campaign_id: string
          p_expires_at?: string
          p_force_new?: boolean
          p_original_url: string
          p_recipient_id: string
        }
        Returns: string
      }
      sms_short_link_health: { Args: never; Returns: Json }
      tracking_retention_sweep: { Args: never; Returns: undefined }
      update_call_signal: {
        Args: {
          p_call_id: string
          p_ice?: Json
          p_role: string
          p_session_token: string
          p_signal: Json
        }
        Returns: undefined
      }
      update_product_cost_price: {
        Args: { p_cost_price: number; p_id: string }
        Returns: undefined
      }
      update_visitor_chat_activity: {
        Args: {
          p_session_id: string
          p_session_token?: string
          p_unread_count: number
          p_visitor_phone?: string
        }
        Returns: undefined
      }
      validate_coupon_code: {
        Args: { _code: string; _subtotal: number }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "editor"
        | "viewer"
        | "order_manager"
        | "product_manager"
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
    Enums: {
      app_role: [
        "admin",
        "editor",
        "viewer",
        "order_manager",
        "product_manager",
      ],
    },
  },
} as const
