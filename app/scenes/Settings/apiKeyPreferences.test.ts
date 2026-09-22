import { TeamPreference } from "@shared/types";
import type { TeamPreferences } from "@shared/types";
import Team from "~/models/Team";
import stores from "~/stores";
import {
  membersCanCreateApiKey,
  membersCanCreateApiKeyUpdate,
} from "./apiKeyPreferences";

const buildTeam = (preferences?: TeamPreferences | null) =>
  new Team(
    {
      id: "team-1",
      name: "Team",
      preferences,
    },
    stores.auth
  );

describe("membersCanCreateApiKey", () => {
  it("returns true when the workspace has no stored preference", () => {
    expect(membersCanCreateApiKey(buildTeam(undefined))).toBe(true);
    expect(membersCanCreateApiKey(buildTeam(null))).toBe(true);
  });

  it("returns true when the stored preference is an empty object", () => {
    expect(membersCanCreateApiKey(buildTeam({}))).toBe(true);
  });

  it("returns false only when the preference is explicitly disabled", () => {
    expect(
      membersCanCreateApiKey(
        buildTeam({ [TeamPreference.MembersCanCreateApiKey]: false })
      )
    ).toBe(false);
  });

  it("returns true when the preference is explicitly enabled", () => {
    expect(
      membersCanCreateApiKey(
        buildTeam({ [TeamPreference.MembersCanCreateApiKey]: true })
      )
    ).toBe(true);
  });
});

describe("membersCanCreateApiKeyUpdate", () => {
  it("sends false when the value is turned off from the default", () => {
    const { preferences } = membersCanCreateApiKeyUpdate(
      buildTeam(undefined),
      false
    );

    expect(preferences[TeamPreference.MembersCanCreateApiKey]).toBe(false);
  });

  it("sends true when the value is turned back on", () => {
    const team = buildTeam({ [TeamPreference.MembersCanCreateApiKey]: false });

    const { preferences } = membersCanCreateApiKeyUpdate(team, true);

    expect(preferences[TeamPreference.MembersCanCreateApiKey]).toBe(true);
  });

  it("preserves unrelated stored preferences", () => {
    const team = buildTeam({
      [TeamPreference.MembersCanCreateApiKey]: true,
      [TeamPreference.SeamlessEdit]: false,
    });

    const { preferences } = membersCanCreateApiKeyUpdate(team, false);

    expect(preferences).toEqual({
      [TeamPreference.MembersCanCreateApiKey]: false,
      [TeamPreference.SeamlessEdit]: false,
    });
  });

  it("round-trips through the model so the switch reflects the new value", () => {
    const team = buildTeam(undefined);

    // The server echoes the saved preferences back, so applying the payload
    // must be enough for the switch to read the new value.
    team.updateData(membersCanCreateApiKeyUpdate(team, false));

    expect(membersCanCreateApiKey(team)).toBe(false);

    team.updateData(membersCanCreateApiKeyUpdate(team, true));

    expect(membersCanCreateApiKey(team)).toBe(true);
  });
});
