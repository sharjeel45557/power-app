import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Table2 } from "lucide-react";
import type { EntityMeta } from "@power-app/core/meta";
import { Badge, Card, CardBody, Spinner } from "../components/ui";
import { api, type StatsResult } from "../lib/api";
import { useAuth } from "../lib/auth";

interface EntityCard {
  meta: EntityMeta;
  stats: StatsResult | null;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<EntityCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .entitiesMeta()
      .then(async (res) => {
        const withStats = await Promise.all(
          res.entities.map(async (meta) => {
            try {
              const stats = await api.stats(meta.name, meta.workflow?.field);
              return { meta, stats };
            } catch {
              return { meta, stats: null };
            }
          }),
        );
        if (active) setCards(withStats);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your internal applications, in one place.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ meta, stats }) => (
            <Link key={meta.name} to={`/e/${meta.name}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardBody className="flex h-full flex-col">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Table2 className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <h3 className="mt-4 font-semibold">{meta.label}</h3>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {stats === null ? "—" : stats.total}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      record{stats?.total === 1 ? "" : "s"}
                    </span>
                  </p>

                  {stats && stats.buckets.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
                      {stats.buckets
                        .slice()
                        .sort((a, b) => b.count - a.count)
                        .map((bucket) => (
                          <span
                            key={bucket.value}
                            className="inline-flex items-center gap-1"
                          >
                            <Badge value={bucket.value} />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {bucket.count}
                            </span>
                          </span>
                        ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
