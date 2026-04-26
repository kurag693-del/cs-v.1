export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      User: {
        Row: {
          id: string
          email: string
          name: string | null
          image: string | null
          emailVerified: string | null
          password: string | null
          role: 'USER' | 'ADMIN'
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          image?: string | null
          emailVerified?: string | null
          password?: string | null
          role?: 'USER' | 'ADMIN'
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          image?: string | null
          emailVerified?: string | null
          password?: string | null
          role?: 'USER' | 'ADMIN'
          createdAt?: string
          updatedAt?: string
        }
      }
      Profile: {
        Row: {
          id: string
          userId: string
          bio: string | null
          avatar: string | null
          brandVoice: string | null
          tone: string | null
          targetAudience: string | null
          preferences: Json | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          bio?: string | null
          avatar?: string | null
          brandVoice?: string | null
          tone?: string | null
          targetAudience?: string | null
          preferences?: Json | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          bio?: string | null
          avatar?: string | null
          brandVoice?: string | null
          tone?: string | null
          targetAudience?: string | null
          preferences?: Json | null
          createdAt?: string
          updatedAt?: string
        }
      }
      Content: {
        Row: {
          id: string
          userId: string
          profileId: string | null
          title: string
          body: string
          platform: 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
          status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
          scheduledAt: string | null
          publishedAt: string | null
          tags: string[]
          metadata: Json | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          profileId?: string | null
          title: string
          body: string
          platform: 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
          status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
          scheduledAt?: string | null
          publishedAt?: string | null
          tags?: string[]
          metadata?: Json | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          profileId?: string | null
          title?: string
          body?: string
          platform?: 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
          status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
          scheduledAt?: string | null
          publishedAt?: string | null
          tags?: string[]
          metadata?: Json | null
          createdAt?: string
          updatedAt?: string
        }
      }
      Schedule: {
        Row: {
          id: string
          userId: string
          contentId: string
          scheduledAt: string
          timezone: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          contentId: string
          scheduledAt: string
          timezone?: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          contentId?: string
          scheduledAt?: string
          timezone?: string
          createdAt?: string
          updatedAt?: string
        }
      }
      Analytics: {
        Row: {
          id: string
          userId: string
          contentType: string | null
          impressions: number
          engagements: number
          clicks: number
          shares: number
          date: string
        }
        Insert: {
          id?: string
          userId: string
          contentType?: string | null
          impressions?: number
          engagements?: number
          clicks?: number
          shares?: number
          date?: string
        }
        Update: {
          id?: string
          userId?: string
          contentType?: string | null
          impressions?: number
          engagements?: number
          clicks?: number
          shares?: string | null
          date?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      UserRole: 'USER' | 'ADMIN'
      Platform: 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
      ContentStatus: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
