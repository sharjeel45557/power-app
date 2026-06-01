import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { EntityMeta } from "@power-app/core/meta";
import { Card, CardBody, CardHeader, CardTitle, Spinner } from "../components/ui";
import { EntityForm } from "../components/EntityForm";
import { ApiError, api, type RecordRow } from "../lib/api";

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

function issuesToFieldErrors(issues: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (Array.isArray(issues)) {
    for (const issue of issues as ZodIssue[]) {
      const key = issue.path?.[0];
      if (typeof key === "string" && !result[key]) result[key] = issue.message;
    }
  }
  return result;
}

export function EntityFormPage() {
  const { entity = "", id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [meta, setMeta] = useState<EntityMeta | null>(null);
  const [initial, setInitial] = useState<RecordRow | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    const work = async () => {
      const m = await api.entityMeta(entity);
      if (active) setMeta(m.entity);
      if (isEdit && id) {
        const rec = await api.get(entity, id);
        if (active) setInitial(rec.data);
      }
    };
    work()
      .catch((err) => active && setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [entity, id, isEdit]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setError(null);
    setFieldErrors({});
    try {
      if (isEdit && id) {
        await api.update(entity, id, values);
      } else {
        await api.create(entity, values);
      }
      navigate(`/e/${entity}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(issuesToFieldErrors(err.issues));
        setError("Please fix the highlighted fields.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!meta) {
    return <Card className="mx-auto max-w-2xl p-6 text-sm text-destructive">{error ?? "Not found."}</Card>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        onClick={() => navigate(`/e/${entity}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {meta.label}
      </button>

      <Card>
        <CardHeader>
          <CardTitle>
            {isEdit ? `Edit ${meta.labelSingular}` : `New ${meta.labelSingular}`}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <EntityForm
            meta={meta}
            initialValues={initial}
            submitLabel={isEdit ? "Save changes" : `Create ${meta.labelSingular}`}
            onSubmit={handleSubmit}
            onCancel={() => navigate(`/e/${entity}`)}
            fieldErrors={fieldErrors}
          />
        </CardBody>
      </Card>
    </div>
  );
}
