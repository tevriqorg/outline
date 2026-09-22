import { TeamPreference } from "@shared/types";
import type { TeamPreferences } from "@shared/types";
import type Team from "~/models/Team";

/**
 * Whether members of the workspace are allowed to create their own API keys.
 *
 * Reads the preference through the model so that the default applies when the
 * workspace has never stored an explicit value. Reading
 * `team.preferences` directly yields `undefined` in that case, which the switch
 * renders as "off" even though the server treats the setting as "on".
 *
 * @param team The current team.
 * @returns true if members can create API keys.
 */
export function membersCanCreateApiKey(team: Team): boolean {
  return !!team.getPreference(TeamPreference.MembersCanCreateApiKey);
}

/**
 * Builds the payload sent when the member API key setting is toggled.
 *
 * The stored preferences are spread back in because `team.update` takes the
 * preference object as a partial patch, and unrelated keys must survive.
 * `teamUpdater` only persists values that differ from the effective preference,
 * so this must always carry the new value rather than the value read from
 * `team.preferences`.
 *
 * @param team The current team.
 * @param checked The new value of the switch.
 * @returns the `team.update` payload.
 */
export function membersCanCreateApiKeyUpdate(
  team: Team,
  checked: boolean
): { preferences: TeamPreferences } {
  return {
    preferences: {
      ...(team.preferences ?? {}),
      [TeamPreference.MembersCanCreateApiKey]: checked,
    },
  };
}
