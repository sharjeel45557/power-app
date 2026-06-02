# Workflows (approvals & status transitions)

A workflow turns a plain status field into a governed **state machine**:
records move between states only via defined **transitions**, and each
transition can be restricted to certain roles. This is how power-app models
approvals — the second of the four target app patterns.

The reference `requests` entity ships with a five-state approval workflow; this
doc explains how it works and how to add one to your own entity.

## Concepts

- **States** — the allowed values of the workflow field (e.g. `submitted`,
  `in_review`, `approved`).
- **Transitions** — named moves from one (or more) states to a target state,
  optionally gated by role and optionally requiring a note.
- **Initial state** — assigned automatically when a record is created.

The workflow field (usually `status`) is **read-only** to normal create/update —
it can only change through a transition. This keeps the state machine
authoritative.

## Declaring a workflow

Add a `workflow` block to your entity definition:

```ts
export const requestsEntity = defineEntity({
  // …name, table, schemas, fields, access…
  workflow: {
    field: "status",
    initial: "submitted",
    states: [
      { name: "submitted", label: "Submitted" },
      { name: "in_review", label: "In Review" },
      { name: "approved", label: "Approved" },
      { name: "rejected", label: "Rejected" },
      { name: "completed", label: "Completed" },
    ],
    transitions: [
      { name: "start_review", label: "Start review", from: ["submitted"], to: "in_review", roles: ["admin", "editor"] },
      { name: "approve",      label: "Approve",      from: ["in_review"], to: "approved",  roles: ["admin"] },
      { name: "reject",       label: "Reject",       from: ["in_review"], to: "rejected",  roles: ["admin"], requireNote: true },
      { name: "complete",     label: "Mark complete",from: ["approved"],  to: "completed", roles: ["admin", "editor"] },
      { name: "reopen",       label: "Reopen",       from: ["rejected", "completed"], to: "submitted", roles: ["admin"] },
    ],
  },
});
```

Make sure the workflow field is **not** in your `createSchema`/`updateSchema`
(so it can't be set directly) and is marked `readOnly: true` in `fields`.

### Transition options

| Field | Meaning |
| --- | --- |
| `name` | Action id used by the API. |
| `label` | Button text in the UI. |
| `from` | States it can fire from; `"*"` = any state. |
| `to` | Resulting state. |
| `roles` | `"*"` (any authenticated user) or a list of roles. Default `"*"`. |
| `requireNote` | If true, a note is required and stored in the audit metadata. |

> Transition roles are **independent** of the entity's `update` access. An
> approver can advance a record without being able to edit its fields.

## API

```
POST /api/entities/:entity/:id/transitions
Body: { "transition": "approve", "note": "optional" }
```

The server enforces, in order:

1. the entity has a workflow (else `400`);
2. the user can `read` the entity (else `403`);
3. the transition exists (else `400`);
4. the record's current state is in the transition's `from` (else `409`);
5. the user holds a permitted role (else `403`);
6. a note is present when `requireNote` (else `422`).

On success it updates the field, bumps `updatedAt`, writes an **audit** record
(`action: "transition"` with `{ from, to, transition, note? }`), and returns the
updated record.

## UI

On a record's detail page the **Workflow** panel shows the current state and a
button for each transition available to the current user from the current state
(computed with `availableTransitions` from `@power-app/core/meta`). Transitions
that require a note prompt for one. The dashboard shows a per-state breakdown via
the stats endpoint (`GET /api/entities/:entity/stats?groupBy=status`).

Because the list view lets anyone with `read` access **open** a record, approvers
who lack edit rights can still act on the workflow.
