ALTER TYPE "public"."bracket_kind" ADD VALUE 'swiss';--> statement-breakpoint
ALTER TYPE "public"."tournament_format" ADD VALUE 'swiss';--> statement-breakpoint
ALTER TABLE "tournament_rules" DROP CONSTRAINT "rules_best_of_ck";--> statement-breakpoint
ALTER TABLE "tournament_rules" DROP CONSTRAINT "rules_points_ck";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_best_of_ck";--> statement-breakpoint
ALTER TABLE "tournament_rounds" DROP CONSTRAINT "rounds_best_of_ck";--> statement-breakpoint
ALTER TABLE "tournament_rules" ADD COLUMN "swiss_decider_best_of" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_rules" ADD COLUMN "playoff_best_of" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_rules" ADD COLUMN "points_draw" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_rules" ADD CONSTRAINT "rules_best_of_ck" CHECK ("tournament_rules"."best_of" in (1, 2, 3, 5, 7) and "tournament_rules"."best_of_final" in (1, 3, 5, 7) and "tournament_rules"."swiss_decider_best_of" in (1, 3, 5, 7) and "tournament_rules"."playoff_best_of" in (1, 3, 5, 7));--> statement-breakpoint
ALTER TABLE "tournament_rules" ADD CONSTRAINT "rules_points_ck" CHECK ("tournament_rules"."points_win" > "tournament_rules"."points_loss" and "tournament_rules"."points_win" >= "tournament_rules"."points_draw" and "tournament_rules"."points_draw" >= "tournament_rules"."points_loss" and "tournament_rules"."points_loss" >= "tournament_rules"."points_forfeit_loss");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_best_of_ck" CHECK ("matches"."best_of" in (1, 2, 3, 5, 7));--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "rounds_best_of_ck" CHECK ("tournament_rounds"."best_of" in (1, 2, 3, 5, 7));