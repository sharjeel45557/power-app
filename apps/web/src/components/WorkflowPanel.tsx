import { useState } from "react";
import {
  availableTransitions,
  type EntityMeta,
  type User,
  type WorkflowTransition,
} from "@power-app/core/meta";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle } from "./ui";

interface WorkflowPanelProps {
  meta: EntityMeta;
  record: Record<string, unknown>;
  user: User | null;
  onTransition: (transition: string, note?: string) => Promise<void>;
}

export function WorkflowPanel({
  meta,
  record,
  user,
  onTransition,
}: WorkflowPanelProps) {
  const workflow = meta.workflow;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!workflow) return null;

  const current = String(record[workflow.field] ?? workflow.initial);
  const transitions = availableTransitions(workflow, current, user);

  const run = async (transition: WorkflowTransition) => {
    let note: string | undefined;
    if (transition.requireNote) {
      const input = window.prompt(`Add a note for "${transition.label}":`);
      if (input === null) return; // cancelled
      note = input;
    }
    setBusy(transition.name);
    setError(null);
    try {
      await onTransition(transition.name, note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workflow</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Current status</span>
          <Badge value={current} />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions available to you from this state.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <Button
                key={t.name}
                size="sm"
                variant={t.name === "reject" ? "destructive" : "primary"}
                loading={busy === t.name}
                disabled={busy !== null}
                onClick={() => void run(t)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
