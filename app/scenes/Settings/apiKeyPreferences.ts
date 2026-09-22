import { TeamPreference } from "@shared/types";
import type { TeamPreferences } from "@shared/types";
import type Team from "~/models/Team";

/**
 * Whether members of the workspace are allowed to create their own API keys.
 *
 * Reads the preference through the model so that the default applies when the
 * workspace has never stored an explicit value. Reading `team.preferences`
 * directly yields `undefined` in that case, which the switch renders as "off"
 * even though the server treats the setting as "on".
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
 * Only the changed preference is sent. `teamUpdater` persists just the keys
 * present in the payload and `TeamsUpdateSchema` treats `preferences` as a
 * partial patch, so omitted keys keep their stored values. Echoing the whole
 * object back instead would push this client's snapshot over concurrent
 * changes made by another admin, and would resubmit any stored value the
 * schema no longer accepts, failing the entire update.
 *
 * `teamUpdater` only writes a value that differs from the effective
 * preference, so the payload must always carry the new value rather than the
 * raw stored one.
 *
 * @param checked The new value of the switch.
 * @returns the `team.update` payload.
 */
export function membersCanCreateApiKeyUpdate(
  checked: boolean
): { preferences: TeamPreferences } {
  return {
    preferences: {
      [TeamPreference.MembersCanCreateApiKey]: checked,
    },
  };
}
