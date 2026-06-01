import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Table2 } from "lucide-react";
import type { EntityMeta } from "@power-app/core/meta";
import { Card, CardBody, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface EntityCard {
  meta: EntityMeta;
  total: number | null;
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
        const withCounts = await Promise.all(
          res.entities.map(async (meta) => {
            try {
              const list = await api.list(meta.name, 1, 1);
              return { meta, total: list.total };
            } catch {
              return { meta, total: null };
            }
          }),
        );
        if (active) setCards(withCounts);
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
          {cards.map(({ meta, total }) => (
            <Link key={meta.name} to={`/e/${meta.name}`} className="group">
              <Card className="transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Table2 className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <h3 className="mt-4 font-semibold">{meta.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {total === null ? "—" : `${total} record${total === 1 ? "" : "s"}`}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
