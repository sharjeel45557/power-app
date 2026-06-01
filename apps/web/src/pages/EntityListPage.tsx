import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import type { EntityMeta, FieldMeta } from "@power-app/core/meta";
import { Badge, Button, Card, Spinner } from "../components/ui";
import { api, type RecordRow } from "../lib/api";
import { formatDateTime } from "../lib/utils";

const BADGE_FIELDS = new Set(["status", "priority"]);

function renderCell(field: FieldMeta, row: RecordRow) {
  const value = row[field.name];
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (BADGE_FIELDS.has(field.name)) return <Badge value={String(value)} />;
  if (field.type === "date" || field.type === "datetime") {
    return formatDateTime(value);
  }
  return String(value);
}

export function EntityListPage() {
  const { entity = "" } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<EntityMeta | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, list] = await Promise.all([
        api.entityMeta(entity),
        api.list(entity, page, pageSize),
      ]);
      setMeta(m.entity);
      setRows(list.data);
      setTotal(list.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [entity, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to first page when switching entities.
  useEffect(() => {
    setPage(1);
  }, [entity]);

  const handleDelete = async (id: string) => {
    if (!meta) return;
    if (!window.confirm(`Delete this ${meta.labelSingular}? This cannot be undone.`)) {
      return;
    }
    await api.remove(entity, id);
    await load();
  };

  if (loading && !meta) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-2xl p-6 text-sm text-destructive">{error}</Card>
    );
  }

  if (!meta) return null;

  const columns = meta.fields.filter((f) => f.showInTable);
  const canCreate = meta.permissions?.create ?? false;
  const canUpdate = meta.permissions?.update ?? false;
  const canDelete = meta.permissions?.delete ?? false;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} record{total === 1 ? "" : "s"}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate(`/e/${entity}/new`)}>
            <Plus className="h-4 w-4" />
            New {meta.labelSingular}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                {columns.map((col) => (
                  <th key={col.name} className="px-4 py-3 font-medium text-muted-foreground">
                    {col.label}
                  </th>
                ))}
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No records yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    {columns.map((col) => (
                      <td key={col.name} className="px-4 py-3">
                        {renderCell(col, row)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/e/${entity}/${row.id}`}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={canUpdate ? "Edit" : "Open"}
                        >
                          {canUpdate ? (
                            <Pencil className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Link>
                        {canDelete && (
                          <button
                            onClick={() => void handleDelete(row.id)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
