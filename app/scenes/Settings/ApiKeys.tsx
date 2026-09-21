import type { ColumnSort } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { CodeIcon } from "outline-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { TeamPreference } from "@shared/types";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Action } from "~/components/Actions";
import Button from "~/components/Button";
import { ConditionalFade } from "~/components/Fade";
import Heading from "~/components/Heading";
import InputSearch from "~/components/InputSearch";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import Switch from "~/components/Switch";
import { createApiKey } from "~/actions/definitions/apiKeys";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import usePolicy from "~/hooks/usePolicy";
import useQuery from "~/hooks/useQuery";
import useStores from "~/hooks/useStores";
import { useTableRequest } from "~/hooks/useTableRequest";
import { ApiKeysTable } from "./components/ApiKeysTable";
import { StickyFilters } from "./components/StickyFilters";
import SettingRow from "./components/SettingRow";
import UserFilter from "~/scenes/Search/components/UserFilter";

function ApiKeys() {
  const team = useCurrentTeam();
  const { t } = useTranslation();
  const { apiKeys } = useStores();
  const can = usePolicy(team);
  const params = useQuery();
  const history = useHistory();
  const location = useLocation();
  const [query, setQuery] = useState(params.get("query") || "");

  const reqParams = useMemo(
    () => ({
      userId: params.get("userId") || undefined,
      query: params.get("query") || undefined,
      sort: params.get("sort") || "createdAt",
      direction: (params.get("direction") || "desc").toUpperCase() as
        | "ASC"
        | "DESC",
    }),
    [params]
  );

  const sort: ColumnSort = useMemo(
    () => ({
      id: reqParams.sort,
      desc: reqParams.direction === "DESC",
    }),
    [reqParams.sort, reqParams.direction]
  );

  const orderedData = apiKeys.orderedData;
  const filteredApiKeys = useMemo(
    () =>
      reqParams.query ? apiKeys.findByQuery(reqParams.query) : orderedData,
    [apiKeys, orderedData, reqParams.query]
  );

  const { data, error, loading, next } = useTableRequest({
    data: filteredApiKeys,
    sort,
    reqFn: apiKeys.fetchPage,
    reqParams,
  });

  const updateParams = useCallback(
    (name: string, value: string) => {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }

      history.replace({
        pathname: location.pathname,
        search: params.toString(),
      });
    },
    [params, history, location.pathname]
  );

  const handleUserFilter = useCallback(
    (userId: string | undefined) => updateParams("userId", userId ?? ""),
    [updateParams]
  );

  const handleMembersCanCreateApiKeyChange = useCallback(
    async (checked: boolean) => {
      try {
        await team.save({
          preferences: {
            ...(team.preferences ?? {}),
            [TeamPreference.MembersCanCreateApiKey]: checked,
          },
        });
        toast.success(t("Settings saved"));
      } catch {
        toast.error(t("Could not save settings"));
      }
    },
    [team, t]
  );

  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    []
  );

  useEffect(() => {
    if (error) {
      toast.error(t("Could not load API keys"));
    }
  }, [t, error]);

  useEffect(() => {
    const timeout = setTimeout(() => updateParams("query", query), 250);
    return () => clearTimeout(timeout);
  }, [query, updateParams]);

  return (
    <Scene
      title={t("API")}
      icon={<CodeIcon />}
      actions={
        <>
          {can.createApiKey && (
            <Action>
              <Button
                type="submit"
                value={`${t("New API key")}…`}
                action={createApiKey}
              />
            </Action>
          )}
        </>
      }
      wide
    >
      <Heading>{t("API Keys")}</Heading>
      <Text as="p" type="secondary">
        <Trans
          defaults="API keys can be used to authenticate with the API and programatically control
          your workspace's data. For more details see the <em>developer documentation</em>."
          components={{
            em: (
              <a
                href="https://www.getoutline.com/developers"
                target="_blank"
                rel="noreferrer"
              />
            ),
          }}
        />
      </Text>
      {can.update && (
        <SettingRow
          label={t("Allow members to create API keys")}
          name={TeamPreference.MembersCanCreateApiKey}
          description={t(
            "When disabled, only workspace admins can create API keys."
          )}
        >
          <Switch
            checked={
              !!team.preferences?.[TeamPreference.MembersCanCreateApiKey]
            }
            onChange={handleMembersCanCreateApiKeyChange}
          />
        </SettingRow>
      )}
      <StickyFilters>
        <UserFilter
          userId={reqParams.userId}
          anyLabel={t("All users")}
          onSelect={handleUserFilter}
        />
        <InputSearch
          short
          value={query}
          placeholder={`${t("Filter")}…`}
          onChange={handleSearch}
        />
      </StickyFilters>
      <ConditionalFade animate={!data}>
        <ApiKeysTable
          data={data ?? []}
          sort={sort}
          loading={loading}
          page={{
            hasNext: !!next,
            fetchNext: next,
          }}
        />
      </ConditionalFade>
    </Scene>
  );
}

export default observer(ApiKeys);
