import { TeamPreference } from "@shared/types";
import {
  buildAdmin,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#apiKeys.create managed credentials", () => {
  it("allows an admin to issue a member key when member self-service is disabled", async () => {
    const team = await buildTeam({
      preferences: { [TeamPreference.MembersCanCreateApiKey]: false },
    });
    const admin = await buildAdmin({ teamId: team.id });
    const member = await buildUser({ teamId: team.id });

    const memberRes = await server.post("/api/apiKeys.create", member, {
      body: {
        name: "Member self-service key",
      },
    });
    expect(memberRes.status).toEqual(403);

    const adminRes = await server.post("/api/apiKeys.create", admin, {
      body: {
        userId: member.id,
        name: "Admin-issued member key",
      },
    });
    const body = await adminRes.json();

    expect(adminRes.status).toEqual(200);
    expect(body.data.user.id).toEqual(member.id);
  });
});
