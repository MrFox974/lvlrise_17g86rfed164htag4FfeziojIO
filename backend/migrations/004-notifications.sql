-- 004-notifications.sql
-- Socle des notifications Web Push :
--   * abonnements des navigateurs (push_subscription)
--   * journal anti-doublon du scheduler (notification_log)
--   * fuseau horaire utilisateur (user.timezone)
--   * heure de rappel et message du jour portés par une routine

CREATE TABLE IF NOT EXISTS push_subscription (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_push_subscription_user
  ON push_subscription (user_id);

CREATE TABLE IF NOT EXISTS notification_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL,
  ref_date DATE NOT NULL,
  routine_id INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Garde-fou anti-doublon : une notification d'un type donné ne part qu'une
-- fois par jour et par utilisateur (par routine pour les rappels).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_unique
  ON notification_log (user_id, kind, ref_date, routine_id);

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris';

ALTER TABLE routine
  ADD COLUMN IF NOT EXISTS reminder_time VARCHAR(5);

ALTER TABLE routine
  ADD COLUMN IF NOT EXISTS greeting VARCHAR(10);

-- Le scheduler balaie les routines à notifier : index sur (user_id, day_of_week)
-- restreint aux lignes qui portent effectivement un rappel.
CREATE INDEX IF NOT EXISTS idx_routine_reminder
  ON routine (user_id, day_of_week)
  WHERE reminder_time IS NOT NULL;
