import { generateEntity, parseFieldSpec } from "./generate.js";

const HELP = `paf — power-app scaffolding CLI

Usage:
  paf new entity <name> [--fields "<spec>"] [--label <text>] [--singular <text>] [--root <dir>]

Arguments:
  <name>              Entity id (plural, lowercase), e.g. "assets"

Options:
  --fields "<spec>"   Comma-separated field specs: name:type[:required]
                      types: text | textarea | email | date | datetime
                      (default: "title:text:required,description:textarea")
  --label <text>      Plural display label (default: derived from name)
  --singular <text>   Singular display label (default: derived from name)
  --root <dir>        Repo root (default: current directory)
  -h, --help          Show this help

Example:
  paf new entity assets --fields "name:text:required,location:text,purchased:date"

This generates an entity definition + migration, adds the Drizzle table, and
registers the entity. Run \`pnpm db:migrate\` afterwards to apply the table.
`;

interface Flags {
  positional: string[];
  options: Record<string, string>;
  help: boolean;
}

function parseArgs(argv: string[]): Flags {
  const positional: string[] = [];
  const options: Record<string, string> = {};
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = "true";
      }
    } else if (arg !== undefined) {
      positional.push(arg);
    }
  }
  return { positional, options, help };
}

async function main() {
  const { positional, options, help } = parseArgs(process.argv.slice(2));

  if (help || positional.length === 0) {
    process.stdout.write(HELP);
    return;
  }

  const [command, subject, name] = positional;

  if (command !== "new" || subject !== "entity") {
    process.stderr.write(`Unknown command: ${positional.join(" ")}\n\n${HELP}`);
    process.exitCode = 1;
    return;
  }

  if (!name) {
    process.stderr.write("Error: entity name is required.\n\n" + HELP);
    process.exitCode = 1;
    return;
  }

  try {
    const result = await generateEntity({
      name: name.toLowerCase(),
      fields: parseFieldSpec(options.fields),
      label: options.label,
      singular: options.singular,
      root: options.root ?? process.cwd(),
    });

    process.stdout.write(`✓ Created entity "${name}"\n\n`);
    for (const f of result.created) process.stdout.write(`  created  ${f}\n`);
    for (const f of result.modified) process.stdout.write(`  updated  ${f}\n`);
    process.stdout.write(
      `\nNext:\n  1. Review the generated files.\n  2. Run \`pnpm db:migrate\` to create the table.\n  3. Restart the dev server — the new app appears in the sidebar.\n`,
    );
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  }
}

void main();
