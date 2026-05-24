import { useLiveQuery } from "dexie-react-hooks";
import { listDailyCosts } from "@firefly/db";
import type { SessionData } from "@firefly/db";
import { Alert, AlertDescription } from "@firefly/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@firefly/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@firefly/ui/components/empty";

export function CostsPanel({ session }: { session?: SessionData }) {
  const dailyCosts = useLiveQuery(async () => await listDailyCosts(), []);

  return (
    <div className="flex flex-col gap-4">
      {session ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
              Active session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">${session.cost.toFixed(4)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {session.usage.totalTokens.toLocaleString()} total tokens
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>
            Open a repository workspace to see per-session cost for the active chat.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
            Daily totals
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(dailyCosts ?? []).map((daily) => (
            <Card key={daily.date} size="sm">
              <CardContent className="text-xs">
                <div className="flex items-center justify-between">
                  <span>{daily.date}</span>
                  <span>${daily.total.toFixed(4)}</span>
                </div>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {Object.entries(daily.byProvider).map(([provider, models]) =>
                    Object.entries(models ?? {}).map(([model, cost]) => (
                      <div
                        className="flex items-center justify-between"
                        key={`${provider}-${model}`}
                      >
                        <span>
                          {provider} · {model}
                        </span>
                        <span>${cost.toFixed(4)}</span>
                      </div>
                    )),
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {dailyCosts?.length ? null : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No usage totals yet.</EmptyTitle>
                <EmptyDescription>
                  Completed assistant messages will appear here once costs are recorded.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
