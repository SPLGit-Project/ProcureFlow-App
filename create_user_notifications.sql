-- Table for In-App Notifications
create table if not exists user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, -- Can link to auth.users or just be the app user ID string
  title text not null,
  message text not null,
  is_read boolean default false,
  link text,
  created_at timestamptz default now()
);

-- Index for faster lookups
create index if not exists idx_user_notifications_user_id on user_notifications(user_id);
