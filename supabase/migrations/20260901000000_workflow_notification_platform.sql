-- ============================================================================
-- Migration: 20260901000000_workflow_notification_platform.sql
-- Description: Unified Workflow & Notification Platform Schema
-- ============================================================================

-- 1. Workflow Definitions Table
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('PROCUREMENT', 'ITEM_LIFECYCLE', 'PRICING', 'SYSTEM')),
    trigger_event TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    stages JSONB NOT NULL DEFAULT '[]'::jsonb,
    notification_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Notification Templates Table
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'GENERAL',
    channels JSONB NOT NULL DEFAULT '{}'::jsonb,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    teams_enabled BOOLEAN NOT NULL DEFAULT true,
    sound_enabled BOOLEAN NOT NULL DEFAULT true,
    digest_frequency TEXT NOT NULL DEFAULT 'INSTANT' CHECK (digest_frequency IN ('INSTANT', 'DAILY_DIGEST', 'WEEKLY')),
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '07:00',
    category_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Notification Delivery Logs Table
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'TEAMS')),
    recipient TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('DELIVERED', 'FAILED', 'SKIPPED', 'QUEUED')),
    title TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enhance user_notifications Table
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'category') THEN
        ALTER TABLE public.user_notifications ADD COLUMN category TEXT NOT NULL DEFAULT 'GENERAL';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'severity') THEN
        ALTER TABLE public.user_notifications ADD COLUMN severity TEXT NOT NULL DEFAULT 'INFO';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'action_url') THEN
        ALTER TABLE public.user_notifications ADD COLUMN action_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'action_label') THEN
        ALTER TABLE public.user_notifications ADD COLUMN action_label TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'entity_type') THEN
        ALTER TABLE public.user_notifications ADD COLUMN entity_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'entity_id') THEN
        ALTER TABLE public.user_notifications ADD COLUMN entity_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'read_at') THEN
        ALTER TABLE public.user_notifications ADD COLUMN read_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'is_archived') THEN
        ALTER TABLE public.user_notifications ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'metadata') THEN
        ALTER TABLE public.user_notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $do$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_category ON public.user_notifications(category);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_key ON public.workflow_definitions(workflow_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON public.notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_created_at ON public.notification_delivery_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "workflow_definitions_read" ON public.workflow_definitions;
CREATE POLICY "workflow_definitions_read" ON public.workflow_definitions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "workflow_definitions_write" ON public.workflow_definitions;
CREATE POLICY "workflow_definitions_write" ON public.workflow_definitions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notification_templates_read" ON public.notification_templates;
CREATE POLICY "notification_templates_read" ON public.notification_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notification_templates_write" ON public.notification_templates;
CREATE POLICY "notification_templates_write" ON public.notification_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_notification_preferences_select" ON public.user_notification_preferences;
CREATE POLICY "user_notification_preferences_select" ON public.user_notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id OR true);

DROP POLICY IF EXISTS "user_notification_preferences_upsert" ON public.user_notification_preferences;
CREATE POLICY "user_notification_preferences_upsert" ON public.user_notification_preferences FOR ALL TO authenticated USING (auth.uid() = user_id OR true) WITH CHECK (auth.uid() = user_id OR true);

DROP POLICY IF EXISTS "notification_delivery_logs_read" ON public.notification_delivery_logs;
CREATE POLICY "notification_delivery_logs_read" ON public.notification_delivery_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notification_delivery_logs_write" ON public.notification_delivery_logs;
CREATE POLICY "notification_delivery_logs_write" ON public.notification_delivery_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_notifications_all_authenticated" ON public.user_notifications;
CREATE POLICY "user_notifications_all_authenticated" ON public.user_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissions Grants
GRANT ALL ON TABLE public.workflow_definitions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.notification_templates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_notification_preferences TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.notification_delivery_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_notifications TO anon, authenticated, service_role;
