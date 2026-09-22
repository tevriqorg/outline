import { TeamPreference } from "@shared/types";
import { ApiKey, Team } from "@server/models";
import { can } from "@server/policies";
import {
  buildAdmin,
  buildApiKey,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

const reloadTeam = (teamId: string) =>
  Team.findByPk(teamId, { rejectOnEmpty: true });

/**
 * The switch reads through `team.getPreference`, which falls back to the
 * default when the workspace has never stored an explicit value. A workspace
 * built by the factories is in exactly that state: the create hook only writes
 * `membersCanInvite`, so `membersCanCreateApiKey` is absent from the stored
 * object even though the effective value is `true`.
 */
describe("membersCanCreateApiKey preference", () => {
  it("has no stored value but is enabled by default on a fresh workspace", async () => {
    const team = await buildTeam();

    expect(team.preferences).not.toHaveProperty(
      TeamPreference.MembersCanCreateApiKey
    );
    expect(team.getPreference(TeamPreference.MembersCanCreateApiKey)).toBe(
      true
    );
  });

  it("persists an explicit false when disabled from the default", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });

    const res = await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: false,
        },
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.preferences[TeamPreference.MembersCanCreateApiKey]).toBe(
      false
    );

    const reloaded = await reloadTeam(team.id);
    expect(
      reloaded.preferences?.[TeamPreference.MembersCanCreateApiKey]
    ).toBe(false);
    expect(reloaded.getPreference(TeamPreference.MembersCanCreateApiKey)).toBe(
      false
    );
  });

  it("keeps showing disabled after a reload", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });

    await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: false,
        },
      },
    });

    const info = await server.post("/api/auth.info", admin);
    const body = await info.json();

    expect(
      body.data.team.preferences[TeamPreference.MembersCanCreateApiKey]
    ).toBe(false);
  });

  it("restores the value when re-enabled", async () => {
    const team = await buildTeam({
      preferences: { [TeamPreference.MembersCanCreateApiKey]: false },
    });
    const admin = await buildAdmin({ teamId: team.id });

    const res = await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: true,
        },
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.preferences[TeamPreference.MembersCanCreateApiKey]).toBe(
      true
    );

    const reloaded = await reloadTeam(team.id);
    expect(
      reloaded.preferences?.[TeamPreference.MembersCanCreateApiKey]
    ).toBe(true);
  });

  it("does not write when the request repeats the effective default", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });

    // Sending `true` while the effective value is already `true` from the
    // default is a genuine no-op, so nothing is persisted. This is exactly the
    // request the buggy switch produced when the user tried to turn the
    // setting off, which is why the setting could never be changed.
    const res = await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: true,
        },
      },
    });

    expect(res.status).toEqual(200);

    const reloaded = await reloadTeam(team.id);
    expect(reloaded.preferences).not.toHaveProperty(
      TeamPreference.MembersCanCreateApiKey
    );
  });

  it("leaves unrelated preferences untouched", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });

    await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: false,
          [TeamPreference.PublicBranding]: true,
        },
      },
    });

    const reloaded = await reloadTeam(team.id);
    expect(reloaded.getPreference(TeamPreference.MembersCanCreateApiKey)).toBe(
      false
    );
    expect(reloaded.getPreference(TeamPreference.PublicBranding)).toBe(true);
  });

  it("keeps other stored preferences when only one is sent", async () => {
    // The UI now sends only the toggled key, relying on teamUpdater treating
    // `preferences` as a partial patch. If that ever stopped holding, omitting
    // a key would silently reset it.
    const team = await buildTeam({
      preferences: { [TeamPreference.PublicBranding]: true },
    });
    const admin = await buildAdmin({ teamId: team.id });

    const res = await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: false,
        },
      },
    });

    expect(res.status).toEqual(200);

    const reloaded = await reloadTeam(team.id);
    expect(reloaded.getPreference(TeamPreference.MembersCanCreateApiKey)).toBe(
      false
    );
    expect(reloaded.getPreference(TeamPreference.PublicBranding)).toBe(true);
  });
});

describe("member API key policy", () => {
  it("allows member self-service while the preference keeps its default", async () => {
    const team = await buildTeam();
    const member = await buildUser({ teamId: team.id });

    expect(can(member, "createApiKey", team)).toBeTruthy();

    const res = await server.post("/api/apiKeys.create", member, {
      body: { name: "Member key" },
    });
    expect(res.status).toEqual(200);
  });

  it("matches the switch after it has been turned off", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });
    const member = await buildUser({ teamId: team.id });

    await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: false,
        },
      },
    });

    const reloaded = await reloadTeam(team.id);
    expect(can(member, "createApiKey", reloaded)).toBe(false);

    const res = await server.post("/api/apiKeys.create", member, {
      body: { name: "Member key" },
    });
    expect(res.status).toEqual(403);
  });

  it("restores member self-service when switched back on", async () => {
    const team = await buildTeam({
      preferences: { [TeamPreference.MembersCanCreateApiKey]: false },
    });
    const admin = await buildAdmin({ teamId: team.id });
    const member = await buildUser({ teamId: team.id });

    await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: true,
        },
      },
    });

    const reloaded = await reloadTeam(team.id);
    expect(can(member, "createApiKey", reloaded)).toBeTruthy();

    const res = await server.post("/api/apiKeys.create", member, {
      body: { name: "Member key" },
    });
    expect(res.status).toEqual(200);
  });
});

describe("admin-managed API key lifecycle", () => {
  it("is unaffected when member self-service is disabled", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });
    const member = await buildUser({ teamId: team.id });

    await server.post("/api/team.update", admin, {
      body: {
        preferences: {
          [TeamPreference.MembersCanCreateApiKey]: false,
        },
      },
    });

    const created = await server.post("/api/apiKeys.create", admin, {
      body: { userId: member.id, name: "Admin-issued key" },
    });
    const createdBody = await created.json();
    expect(created.status).toEqual(200);
    expect(createdBody.data.user.id).toEqual(member.id);

    const listed = await server.post("/api/apiKeys.list", admin, {
      body: { userId: member.id },
    });
    const listedBody = await listed.json();
    expect(listed.status).toEqual(200);
    expect(listedBody.data.map((key: { id: string }) => key.id)).toContain(
      createdBody.data.id
    );

    const deleted = await server.post("/api/apiKeys.delete", admin, {
      body: { id: createdBody.data.id },
    });
    expect(deleted.status).toEqual(200);
  });

  it("lets an admin manage a key issued to another user", async () => {
    const team = await buildTeam({
      preferences: { [TeamPreference.MembersCanCreateApiKey]: false },
    });
    const admin = await buildAdmin({ teamId: team.id });
    const member = await buildUser({ teamId: team.id });
    await buildApiKey({ userId: member.id });

    const apiKey = await ApiKey.scope("withUser").findOne({
      where: { userId: member.id },
      rejectOnEmpty: true,
    });

    expect(can(admin, "read", apiKey)).toBeTruthy();
    expect(can(admin, "delete", apiKey)).toBeTruthy();
  });
});
