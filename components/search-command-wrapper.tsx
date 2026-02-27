"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchTrigger, SearchCommand } from "@rx-lab/dashboard-searching-ui";

interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  type: "subscription" | "proxy-group";
  url: string;
}

export function SearchCommandWrapper() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const onSearch = useCallback(
    async ({
      query,
      limit,
    }: {
      query: string;
      searchType?: string;
      limit?: number;
    }) => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&limit=${limit ?? 10}`,
      );
      if (!res.ok) return [];
      return (await res.json()) as SearchResult[];
    },
    [],
  );

  const onResultSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      router.push(result.url);
    },
    [router],
  );

  return (
    <>
      <SearchTrigger
        onClick={() => setOpen(true)}
        placeholder="Search subscriptions..."
      />
      <SearchCommand
        open={open}
        onOpenChange={setOpen}
        onSearch={onSearch}
        onResultSelect={onResultSelect}
        placeholder="Search subscriptions..."
        debounceMs={3000}
        chatHistoryStorageKey="search-agent-chat-history"
        enableAgentMode
        agentConfig={{
          apiEndpoint: "/api/search-agent",
          header: {
            title: "Config Assistant",
          },
          input: {
            placeholder: "Ask about your subscriptions...",
          },
          toolResultRenderers: {
            list_subscriptions: ({ output }) => {
              const data = output as {
                subscriptions: {
                  id: string;
                  name: string;
                  sourceType: string;
                }[];
              };
              return (
                <div className="space-y-1 text-sm">
                  {data.subscriptions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="font-medium">
                        Current config: {s.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {s.sourceType}
                      </span>
                    </div>
                  ))}
                </div>
              );
            },
            get_subscription: ({ output }) => {
              const data = output as {
                name: string;
                config: {
                  servers: { id: string; name: string; type: string }[];
                  proxyGroups: { id: string; name: string; type: string }[];
                };
              };
              return (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">{data.name}</div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">
                      Servers ({data.config.servers.length})
                    </div>
                    {data.config.servers.slice(0, 5).map((s) => (
                      <div key={s.id} className="text-xs">
                        {s.name}{" "}
                        <span className="text-muted-foreground">
                          ({s.type})
                        </span>
                      </div>
                    ))}
                    {data.config.servers.length > 5 && (
                      <div className="text-muted-foreground text-xs">
                        ...and {data.config.servers.length - 5} more
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">
                      Proxy Groups ({data.config.proxyGroups.length})
                    </div>
                    {data.config.proxyGroups.slice(0, 5).map((g) => (
                      <div key={g.id} className="text-xs">
                        {g.name}{" "}
                        <span className="text-muted-foreground">
                          ({g.type})
                        </span>
                      </div>
                    ))}
                    {data.config.proxyGroups.length > 5 && (
                      <div className="text-muted-foreground text-xs">
                        ...and {data.config.proxyGroups.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              );
            },
          },
        }}
        renderResult={(result: SearchResult, onSelect) => (
          <div
            key={result.id}
            className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-accent"
            onClick={() => onSelect()}
          >
            <div>
              <div className="text-sm font-medium">{result.title}</div>
              <div className="text-muted-foreground text-xs">
                {result.snippet}
              </div>
            </div>
          </div>
        )}
      />
    </>
  );
}
