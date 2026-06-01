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

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(5000).optional().nullable(),
  category: z.enum(categories).default("general"),
  priority: z.enum(priorities).default("normal"),
  status: z.enum(statuses).optional(),
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
      helpText: "Workflow transitions arrive in Phase 2.",
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
});
