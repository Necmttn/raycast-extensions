import { List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";

import { getGitHubClient } from "./api/githubClient";
import { getBoundedPreferenceNumber } from "./components/Menu";
import RepositoryListEmptyView from "./components/RepositoryListEmptyView";
import RepositoryListItem from "./components/RepositoryListItem";
import SearchRepositoryDropdown from "./components/SearchRepositoryDropdown";
import { ExtendedRepositoryFieldsFragment } from "./generated/graphql";
import { REPO_DEFAULT_SORT_QUERY, useHistory } from "./helpers/repository";
import { withGitHubClient } from "./helpers/withGithubClient";

function SearchRepositories() {
  const { github } = getGitHubClient();

  const preferences = getPreferenceValues<Preferences.SearchRepositories>();

  const [searchText, setSearchText] = useState("");
  const [searchFilter, setSearchFilter] = useState<string | null>(null);
  const [sortQuery, setSortQuery] = useCachedState<string>("sort-query", REPO_DEFAULT_SORT_QUERY, {
    cacheNamespace: "github-search-repo",
  });

  const { data: history, visitRepository } = useHistory(searchText, searchFilter);
  const query = useMemo(
    () =>
      `${searchFilter} ${searchText} ${sortQuery} fork:${preferences.includeForks} ${
        preferences.includeArchived ? "" : "archived:false"
      }`,
    [searchText, searchFilter, sortQuery],
  );

  const {
    data,
    isLoading,
    mutate: mutateList,
  } = useCachedPromise(
    async (query) => {
      const result = await github.searchRepositories({
        query,
        numberOfItems: getBoundedPreferenceNumber({ name: "numberOfResults", default: 50 }),
      });

      return result.search.nodes?.map((node) => node as ExtendedRepositoryFieldsFragment);
    },
    [query],
    { keepPreviousData: true },
  );

  // Update visited repositories (history) if any of the metadata changes, especially the repository name.
  useEffect(() => {
    history.forEach((repository) => data?.find((r) => r.id === repository.id && visitRepository(r)));
  }, [data]);

  const foundRepositories = useMemo(
    () => data?.filter((repository) => !history.find((r) => r.id === repository.id)),
    [data],
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search in public and private repositories"
      onSearchTextChange={setSearchText}
      searchBarAccessory={<SearchRepositoryDropdown onFilterChange={setSearchFilter} />}
      throttle
    >
      <List.Section title="Visited Repositories" subtitle={history ? String(history.length) : undefined}>
        {history.map((repository) => (
          <RepositoryListItem
            key={repository.id}
            {...{ repository, onVisit: visitRepository, mutateList, sortQuery, setSortQuery }}
          />
        ))}
      </List.Section>

      {foundRepositories ? (
        <List.Section
          title={searchText ? "Search Results" : "Found Repositories"}
          subtitle={`${foundRepositories.length}`}
        >
          {foundRepositories.map((repository) => {
            return (
              <RepositoryListItem
                key={repository.id}
                {...{ repository, onVisit: visitRepository, mutateList, sortQuery, setSortQuery }}
              />
            );
          })}
        </List.Section>
      ) : null}

      <RepositoryListEmptyView searchText={searchText} isLoading={isLoading} />
    </List>
  );
}

export default withGitHubClient(SearchRepositories);
