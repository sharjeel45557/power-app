import { inMemoryResource, type ConnectorResource } from "@power-app/connectors";

/**
 * A demo connector so the connector pipeline is exercisable without external
 * systems (registered in dev / when CONNECTORS_DEMO=true). It stands in for a
 * SharePoint list — "Vendor Contacts" — with the same shape a real list would
 * have, so the UI and routes look identical to the production case.
 */
export function demoConnector(): ConnectorResource {
  return inMemoryResource({
    name: "vendor_contacts",
    label: "Vendor Contacts",
    labelSingular: "Vendor Contact",
    source: "SharePoint (demo)",
    access: {
      list: "*",
      read: "*",
      create: ["admin", "editor"],
      update: ["admin", "editor"],
      delete: ["admin"],
    },
    fields: [
      { name: "company", label: "Company", type: "text", required: true, showInTable: true },
      { name: "contact", label: "Contact Name", type: "text", showInTable: true },
      { name: "email", label: "Email", type: "email", showInTable: true },
      { name: "category", label: "Category", type: "text", showInTable: true },
      { name: "createdBy", label: "Added By", type: "text", readOnly: true, showInTable: true },
    ],
    seed: [
      { company: "Acme Medical Supplies", contact: "Dana Reed", email: "dana@acmemed.example", category: "Consumables" },
      { company: "Northwind Diagnostics", contact: "Sam Patel", email: "sam@northwind.example", category: "Lab" },
      { company: "Contoso Imaging", contact: "Lee Cho", email: "lee@contoso.example", category: "Radiology" },
    ],
  });
}
