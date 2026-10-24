CREATE TYPE "public"."announcement_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."approval_mode" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."bracket_kind" AS ENUM('winners', 'losers', 'grand_final', 'league');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."lol_position" AS ENUM('top', 'jungle', 'mid', 'bottom', 'support', 'fill');--> statement-breakpoint
CREATE TYPE "public"."match_side" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'scheduled', 'in_progress', 'awaiting_validation', 'disputed', 'confirmed', 'void');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('avatar', 'team_logo', 'tournament_banner', 'evidence');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('active', 'disqualified');--> statement-breakpoint
CREATE TYPE "public"."participant_type" AS ENUM('team', 'solo');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'rejected', 'waitlisted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."result_status" AS ENUM('pending', 'accepted', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('active', 'disbanded');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('single_elimination', 'double_elimination', 'league');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'published', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tournament_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'organizer', 'admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"kind" "media_kind" NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"data" "bytea" NOT NULL,
	"is_public" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_size_ck" CHECK ("media"."byte_size" > 0 and "media"."byte_size" <= 3145728)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"riot_game_name" text,
	"riot_tag_line" text,
	"region" text,
	"main_position" "lol_position",
	"bio" text,
	"avatar_media_id" uuid,
	"is_public" boolean DEFAULT true NOT NULL,
	"notify_by_email" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle"),
	CONSTRAINT "profiles_handle_ck" CHECK ("profiles"."handle" ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
	CONSTRAINT "profiles_riot_id_ck" CHECK (("profiles"."riot_game_name" is null) = ("profiles"."riot_tag_line" is null))
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"invitee_id" text NOT NULL,
	"invited_by_id" text,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"position" "lol_position",
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tag" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_media_id" uuid,
	"captain_id" text NOT NULL,
	"created_by_id" text,
	"status" "team_status" DEFAULT 'active' NOT NULL,
	"disbanded_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug"),
	CONSTRAINT "teams_tag_ck" CHECK ("teams"."tag" ~ '^[A-Za-z0-9]{2,5}$')
);
--> statement-breakpoint
CREATE TABLE "tournament_registration_members" (
	"registration_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"is_substitute" boolean DEFAULT false NOT NULL,
	CONSTRAINT "tournament_registration_members_registration_id_user_id_pk" PRIMARY KEY("registration_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"team_id" uuid,
	"user_id" text,
	"seed" integer,
	"status" "participant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_participants_registration_id_unique" UNIQUE("registration_id"),
	CONSTRAINT "participants_one_entrant_ck" CHECK (("tournament_participants"."team_id" is null) <> ("tournament_participants"."user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"team_id" uuid,
	"user_id" text,
	"submitted_by_id" text,
	"status" "registration_status" NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_one_entrant_ck" CHECK (("tournament_registrations"."team_id" is null) <> ("tournament_registrations"."user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "tournament_rules" (
	"tournament_id" uuid PRIMARY KEY NOT NULL,
	"team_size" integer DEFAULT 5 NOT NULL,
	"max_substitutes" integer DEFAULT 2 NOT NULL,
	"best_of" integer DEFAULT 1 NOT NULL,
	"best_of_final" integer DEFAULT 3 NOT NULL,
	"points_win" integer DEFAULT 3 NOT NULL,
	"points_loss" integer DEFAULT 0 NOT NULL,
	"points_forfeit_loss" integer DEFAULT 0 NOT NULL,
	"tiebreakers" text[] DEFAULT array['head_to_head','game_difference','games_won']::text[] NOT NULL,
	"league_legs" integer DEFAULT 1 NOT NULL,
	"grand_final_reset" boolean DEFAULT true NOT NULL,
	"approval_mode" "approval_mode" DEFAULT 'manual' NOT NULL,
	"waitlist_enabled" boolean DEFAULT true NOT NULL,
	"require_riot_id" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rules_team_size_ck" CHECK ("tournament_rules"."team_size" between 1 and 5),
	CONSTRAINT "rules_subs_ck" CHECK ("tournament_rules"."max_substitutes" between 0 and 5),
	CONSTRAINT "rules_best_of_ck" CHECK ("tournament_rules"."best_of" in (1, 3, 5, 7) and "tournament_rules"."best_of_final" in (1, 3, 5, 7)),
	CONSTRAINT "rules_legs_ck" CHECK ("tournament_rules"."league_legs" in (1, 2)),
	CONSTRAINT "rules_points_ck" CHECK ("tournament_rules"."points_win" > "tournament_rules"."points_loss" and "tournament_rules"."points_loss" >= "tournament_rules"."points_forfeit_loss")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"description" text,
	"rules_text" text,
	"prize_description" text,
	"banner_media_id" uuid,
	"organizer_id" text NOT NULL,
	"format" "tournament_format" NOT NULL,
	"participant_type" "participant_type" DEFAULT 'team' NOT NULL,
	"visibility" "tournament_visibility" DEFAULT 'public' NOT NULL,
	"access_code" text,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"region" text,
	"registration_opens_at" timestamp with time zone NOT NULL,
	"registration_closes_at" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"min_participants" integer NOT NULL,
	"max_participants" integer NOT NULL,
	"published_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tournaments_participants_ck" CHECK ("tournaments"."min_participants" >= 2 and "tournaments"."max_participants" >= "tournaments"."min_participants" and "tournaments"."max_participants" <= 256),
	CONSTRAINT "tournaments_dates_ck" CHECK ("tournaments"."registration_opens_at" < "tournaments"."registration_closes_at" and "tournaments"."registration_closes_at" <= "tournaments"."starts_at"),
	CONSTRAINT "tournaments_ends_ck" CHECK ("tournaments"."ends_at" is null or "tournaments"."ends_at" >= "tournaments"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"opened_by_id" text,
	"participant_id" uuid,
	"result_id" uuid,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"game_number" integer NOT NULL,
	"winner_id" uuid NOT NULL,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_games_duration_ck" CHECK ("match_games"."duration_seconds" is null or "match_games"."duration_seconds" between 60 and 10800)
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"reported_by_id" text,
	"reporting_participant_id" uuid,
	"score_a" integer NOT NULL,
	"score_b" integer NOT NULL,
	"is_forfeit" boolean DEFAULT false NOT NULL,
	"game_winners" text[],
	"mvp_user_id" text,
	"notes" text,
	"status" "result_status" DEFAULT 'pending' NOT NULL,
	"opponent_confirmed_at" timestamp with time zone,
	"opponent_confirmed_by_id" text,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"participant_a_id" uuid,
	"participant_b_id" uuid,
	"slot_a_dead" boolean DEFAULT false NOT NULL,
	"slot_b_dead" boolean DEFAULT false NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"best_of" integer NOT NULL,
	"winner_id" uuid,
	"score_a" integer,
	"score_b" integer,
	"is_bye" boolean DEFAULT false NOT NULL,
	"is_forfeit" boolean DEFAULT false NOT NULL,
	"mvp_user_id" text,
	"scheduled_at" timestamp with time zone,
	"next_match_id" uuid,
	"next_slot" "match_side",
	"loser_next_match_id" uuid,
	"loser_next_slot" "match_side",
	"confirmed_at" timestamp with time zone,
	"confirmed_by_id" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_best_of_ck" CHECK ("matches"."best_of" in (1, 3, 5, 7)),
	CONSTRAINT "matches_winner_ck" CHECK ("matches"."winner_id" is null or "matches"."winner_id" = "matches"."participant_a_id" or "matches"."winner_id" = "matches"."participant_b_id"),
	CONSTRAINT "matches_distinct_ck" CHECK ("matches"."participant_a_id" is null or "matches"."participant_a_id" <> "matches"."participant_b_id")
);
--> statement-breakpoint
CREATE TABLE "result_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid,
	"dispute_id" uuid,
	"match_id" uuid NOT NULL,
	"media_id" uuid,
	"url" text,
	"description" text,
	"uploaded_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_evidence_source_ck" CHECK ("result_evidence"."media_id" is not null or "result_evidence"."url" is not null),
	CONSTRAINT "result_evidence_owner_ck" CHECK ("result_evidence"."result_id" is not null or "result_evidence"."dispute_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "tournament_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"bracket" "bracket_kind" NOT NULL,
	"number" integer NOT NULL,
	"best_of" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_best_of_ck" CHECK ("tournament_rounds"."best_of" in (1, 3, 5, 7))
);
--> statement-breakpoint
CREATE TABLE "tournament_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"format" "tournament_format" NOT NULL,
	"status" "stage_status" DEFAULT 'in_progress' NOT NULL,
	"generated_by_id" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "announcement_status" DEFAULT 'draft' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"tournament_id" uuid,
	"author_id" text,
	"published_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"tournament_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"legal_reviewed" boolean DEFAULT false NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"email_pending" boolean DEFAULT false NOT NULL,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_media_id_media_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_id_users_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registration_members" ADD CONSTRAINT "tournament_registration_members_registration_id_tournament_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."tournament_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registration_members" ADD CONSTRAINT "tournament_registration_members_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registration_members" ADD CONSTRAINT "tournament_registration_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_registration_id_tournament_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."tournament_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rules" ADD CONSTRAINT "tournament_rules_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_banner_media_id_media_id_fk" FOREIGN KEY ("banner_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_participant_id_tournament_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."tournament_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_result_id_match_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."match_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_winner_id_tournament_participants_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."tournament_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_reporting_participant_id_tournament_participants_id_fk" FOREIGN KEY ("reporting_participant_id") REFERENCES "public"."tournament_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_mvp_user_id_users_id_fk" FOREIGN KEY ("mvp_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_opponent_confirmed_by_id_users_id_fk" FOREIGN KEY ("opponent_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stage_id_tournament_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."tournament_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_tournament_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."tournament_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_participant_a_id_tournament_participants_id_fk" FOREIGN KEY ("participant_a_id") REFERENCES "public"."tournament_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_participant_b_id_tournament_participants_id_fk" FOREIGN KEY ("participant_b_id") REFERENCES "public"."tournament_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_tournament_participants_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."tournament_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_mvp_user_id_users_id_fk" FOREIGN KEY ("mvp_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_next_match_id_matches_id_fk" FOREIGN KEY ("next_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_loser_next_match_id_matches_id_fk" FOREIGN KEY ("loser_next_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_evidence" ADD CONSTRAINT "result_evidence_result_id_match_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."match_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_evidence" ADD CONSTRAINT "result_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_evidence" ADD CONSTRAINT "result_evidence_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_evidence" ADD CONSTRAINT "result_evidence_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_evidence" ADD CONSTRAINT "result_evidence_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_stage_id_tournament_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."tournament_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_stages" ADD CONSTRAINT "tournament_stages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_stages" ADD CONSTRAINT "tournament_stages_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "media" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_riot_id_uq" ON "profiles" USING btree (lower("riot_game_name"),lower("riot_tag_line")) WHERE "profiles"."riot_game_name" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_pending_uq" ON "team_invitations" USING btree ("team_id","invitee_id") WHERE "team_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "team_invitations_invitee_idx" ON "team_invitations" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_uq" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_name_active_uq" ON "teams" USING btree (lower("name")) WHERE "teams"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "teams_tag_active_uq" ON "teams" USING btree (lower("tag")) WHERE "teams"."status" = 'active';--> statement-breakpoint
CREATE INDEX "teams_captain_idx" ON "teams" USING btree ("captain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_members_tournament_user_uq" ON "tournament_registration_members" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE INDEX "participants_tournament_idx" ON "tournament_participants" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "participants_team_idx" ON "tournament_participants" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "participants_user_idx" ON "tournament_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_seed_uq" ON "tournament_participants" USING btree ("tournament_id","seed") WHERE "tournament_participants"."seed" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_team_uq" ON "tournament_registrations" USING btree ("tournament_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_user_uq" ON "tournament_registrations" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE INDEX "registrations_tournament_status_idx" ON "tournament_registrations" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "tournaments_status_starts_idx" ON "tournaments" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "tournaments_organizer_idx" ON "tournaments" USING btree ("organizer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_open_uq" ON "disputes" USING btree ("match_id") WHERE "disputes"."status" = 'open';--> statement-breakpoint
CREATE INDEX "disputes_tournament_status_idx" ON "disputes" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "match_games_number_uq" ON "match_games" USING btree ("match_id","game_number");--> statement-breakpoint
CREATE INDEX "match_results_match_idx" ON "match_results" USING btree ("match_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "match_results_pending_uq" ON "match_results" USING btree ("match_id","reporting_participant_id") WHERE "match_results"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "matches_round_position_uq" ON "matches" USING btree ("round_id","position");--> statement-breakpoint
CREATE INDEX "matches_tournament_status_idx" ON "matches" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "matches_participant_a_idx" ON "matches" USING btree ("participant_a_id");--> statement-breakpoint
CREATE INDEX "matches_participant_b_idx" ON "matches" USING btree ("participant_b_id");--> statement-breakpoint
CREATE INDEX "matches_scheduled_idx" ON "matches" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "result_evidence_match_idx" ON "result_evidence" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_stage_bracket_number_uq" ON "tournament_rounds" USING btree ("stage_id","bracket","number");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_tournament_number_uq" ON "tournament_stages" USING btree ("tournament_id","number");--> statement-breakpoint
CREATE INDEX "announcements_status_published_idx" ON "announcements" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_tournament_idx" ON "audit_logs" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;