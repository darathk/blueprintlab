-- ============================================================
-- Push Notifications: Database Webhook Setup
-- ============================================================
-- Run this in Supabase SQL Editor after deploying the edge function.
--
-- The PushSubscription table is managed by Prisma (schema.prisma).
-- This SQL only sets up the webhook trigger.
-- ============================================================

-- 1. Enable the pg_net extension (required for HTTP webhooks)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create a function that fires the edge function on new messages
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS trigger AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- These should match your Supabase project
  -- Replace <project-ref> with your actual project reference
  edge_function_url := 'https://<project-ref>.supabase.co/functions/v1/notify-on-message';

  -- Use your service role key (set as a Postgres config variable or hardcode for testing)
  -- To set: ALTER DATABASE postgres SET app.settings.service_role_key = 'your-key';
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fire HTTP request to the edge function (non-blocking via pg_net)
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to the Message table
DROP TRIGGER IF EXISTS on_new_message_notify ON "Message";
CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON "Message"
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_message();

-- ============================================================
-- ALTERNATIVE: Use the Supabase Dashboard UI instead of this SQL.
-- Go to Database → Webhooks → Create Webhook:
--   Name: notify-on-message
--   Table: Message
--   Events: INSERT
--   Type: Supabase Edge Function
--   Function: notify-on-message
-- ============================================================
