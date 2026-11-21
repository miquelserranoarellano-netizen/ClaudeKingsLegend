ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_registration_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournaments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "result_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "profiles_avatar_idx" ON "profiles" USING btree ("avatar_media_id") WHERE "profiles"."avatar_media_id" is not null;--> statement-breakpoint
CREATE INDEX "teams_logo_idx" ON "teams" USING btree ("logo_media_id") WHERE "teams"."logo_media_id" is not null;--> statement-breakpoint
CREATE INDEX "registration_members_user_idx" ON "tournament_registration_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "registrations_team_idx" ON "tournament_registrations" USING btree ("team_id") WHERE "tournament_registrations"."team_id" is not null;--> statement-breakpoint
CREATE INDEX "registrations_user_idx" ON "tournament_registrations" USING btree ("user_id") WHERE "tournament_registrations"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "tournaments_banner_idx" ON "tournaments" USING btree ("banner_media_id") WHERE "tournaments"."banner_media_id" is not null;--> statement-breakpoint
CREATE INDEX "disputes_match_idx" ON "disputes" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "matches_stage_idx" ON "matches" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "matches_next_idx" ON "matches" USING btree ("next_match_id") WHERE "matches"."next_match_id" is not null;--> statement-breakpoint
CREATE INDEX "matches_loser_next_idx" ON "matches" USING btree ("loser_next_match_id") WHERE "matches"."loser_next_match_id" is not null;--> statement-breakpoint
CREATE INDEX "result_evidence_media_idx" ON "result_evidence" USING btree ("media_id") WHERE "result_evidence"."media_id" is not null;--> statement-breakpoint
CREATE INDEX "result_evidence_result_idx" ON "result_evidence" USING btree ("result_id") WHERE "result_evidence"."result_id" is not null;--> statement-breakpoint
CREATE INDEX "result_evidence_dispute_idx" ON "result_evidence" USING btree ("dispute_id") WHERE "result_evidence"."dispute_id" is not null;--> statement-breakpoint
CREATE INDEX "rounds_tournament_idx" ON "tournament_rounds" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "announcements_tournament_idx" ON "announcements" USING btree ("tournament_id") WHERE "announcements"."tournament_id" is not null;--> statement-breakpoint
-- Supabase publica el esquema `public` en su API REST con los roles `anon` y `authenticated`. Esta
-- aplicación no la usa (todo pasa por el servidor con su propia conexión), así que se cierra del todo:
-- con RLS activado y sin políticas no ven ninguna fila, y además se les retiran los permisos, también
-- sobre las tablas que se creen después. En un Postgres sin esos roles (Docker, PGlite) no hace nada.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
