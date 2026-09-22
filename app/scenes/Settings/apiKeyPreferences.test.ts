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

  it("ignores unrelated stored preferences", () => {
    expect(
      membersCanCreateApiKey(
        buildTeam({ [TeamPreference.PublicBranding]: false })
      )
    ).toBe(true);
  });
});

describe("membersCanCreateApiKeyUpdate", () => {
  it("sends false when the value is turned off from the default", () => {
    const { preferences } = membersCanCreateApiKeyUpdate(false);

    expect(preferences[TeamPreference.MembersCanCreateApiKey]).toBe(false);
  });

  it("sends true when the value is turned back on", () => {
    const { preferences } = membersCanCreateApiKeyUpdate(true);

    expect(preferences[TeamPreference.MembersCanCreateApiKey]).toBe(true);
  });

  it("sends only the changed preference", () => {
    // Omitted keys are preserved server-side by teamUpdater, so the payload
    // must not echo other preferences back over concurrent changes.
    const { preferences } = membersCanCreateApiKeyUpdate(false);

    expect(Object.keys(preferences)).toEqual([
      TeamPreference.MembersCanCreateApiKey,
    ]);
  });

  it("round-trips through the model so the switch reflects the new value", () => {
    const team = buildTeam(undefined);

    // The server echoes the full preferences back, so applying the saved
    // payload must be enough for the switch to read the new value.
    team.updateData(membersCanCreateApiKeyUpdate(false));
    expect(membersCanCreateApiKey(team)).toBe(false);

    team.updateData(membersCanCreateApiKeyUpdate(true));
    expect(membersCanCreateApiKey(team)).toBe(true);
  });

  it("does not disturb other preferences once the server response is applied", () => {
    const team = buildTeam({ [TeamPreference.PublicBranding]: true });

    // teamUpdater keeps keys it does not write, and presentTeam echoes the
    // merged object back, so the response carries every stored preference.
    team.updateData({
      preferences: {
        [TeamPreference.PublicBranding]: true,
        ...membersCanCreateApiKeyUpdate(false).preferences,
      },
    });

    expect(membersCanCreateApiKey(team)).toBe(false);
    expect(team.getPreference(TeamPreference.PublicBranding)).toBe(true);
  });
});
