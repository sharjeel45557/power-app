import { z } from "zod";
import { defineEntity, type FieldOption } from "@power-app/core";
import { requests } from "../db/schema.js";

const categories = ["general", "it", "facilities", "hr", "clinical"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const statuses = [
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "completed",
] as const;

const opts = (values: readonly string[]): FieldOption[] =>
  values.map((v) => ({
    value: v,
    label: v
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

// `status` is workflow-managed (see `workflow` below), so it is intentionally
// absent from the create/update schemas — it can only change via transitions.
const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(5000).optional().nullable(),
  category: z.enum(categories).default("general"),
  priority: z.enum(priorities).default("normal"),
});

const updateSchema = createSchema.partial();

/**
 * The reference entity. A developer adds a file like this (plus a Drizzle table
 * and a migration) and immediately gets a REST API, a validated form, a
 * filterable table, RBAC, and audit logging — no SharePoint, no PowerApps.
 */
export const requestsEntity = defineEntity({
  name: "requests",
  label: "Service Requests",
  labelSingular: "Service Request",
  table: requests,
  createSchema,
  updateSchema,
  defaultSort: { field: "createdAt", dir: "desc" },
  fields: [
    {
      name: "title",
      label: "Title",
      type: "text",
      required: true,
      showInTable: true,
      placeholder: "Short summary of the request",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      helpText: "Provide any detail that will help whoever picks this up.",
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: opts(categories),
      showInTable: true,
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      required: true,
      options: opts(priorities),
      showInTable: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: opts(statuses),
      showInTable: true,
      readOnly: true,
      helpText: "Managed by the approval workflow.",
    },
    {
      name: "createdBy",
      label: "Created By",
      type: "text",
      readOnly: true,
      showInTable: true,
    },
    {
      name: "createdAt",
      label: "Created",
      type: "datetime",
      readOnly: true,
      showInTable: true,
    },
  ],
  access: {
    list: "*",
    read: "*",
    create: "*",
    update: ["admin", "editor"],
    delete: ["admin"],
  },
  workflow: {
    field: "status",
    initial: "submitted",
    states: opts(statuses).map((o) => ({ name: o.value, label: o.label })),
    transitions: [
      {
        name: "start_review",
        label: "Start review",
        from: ["submitted"],
        to: "in_review",
        roles: ["admin", "editor"],
      },
      {
        name: "approve",
        label: "Approve",
        from: ["in_review"],
        to: "approved",
        roles: ["admin"],
      },
      {
        name: "reject",
        label: "Reject",
        from: ["in_review"],
        to: "rejected",
        roles: ["admin"],
        requireNote: true,
      },
      {
        name: "complete",
        label: "Mark complete",
        from: ["approved"],
        to: "completed",
        roles: ["admin", "editor"],
      },
      {
        name: "reopen",
        label: "Reopen",
        from: ["rejected", "completed"],
        to: "submitted",
        roles: ["admin"],
      },
    ],
  },
});
