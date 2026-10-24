import type { RoundName } from "@/domain/competition/round-names";
import { t } from "@/i18n";

export function roundLabel(name: RoundName): string {
  if (name.key === "rounds.winners") return t("rounds.winners", { name: roundLabel(name.params.name) });
  return t(name.key, name.params);
}
