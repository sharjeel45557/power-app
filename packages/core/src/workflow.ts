import type {
  User,
  WorkflowDefinition,
  WorkflowTransition,
} from "./types.js";

/** Looks up a transition by its action id. */
export function findTransition(
  workflow: WorkflowDefinition,
  name: string,
): WorkflowTransition | null {
  return workflow.transitions.find((t) => t.name === name) ?? null;
}

/** True if `transition` may legally fire from `currentState`. */
export function canFireFrom(
  transition: WorkflowTransition,
  currentState: string,
): boolean {
  return transition.from === "*" || transition.from.includes(currentState);
}

/** True if `user` is permitted to perform `transition` (role check only). */
export function userCanTransition(
  user: User | null | undefined,
  transition: WorkflowTransition,
): boolean {
  if (!user) return false;
  const roles = transition.roles ?? "*";
  if (roles === "*") return true;
  return roles.some((role) => user.roles.includes(role));
}

/**
 * Transitions available to `user` from `currentState`. Used by the client to
 * render action buttons and by the server as the authoritative gate.
 */
export function availableTransitions(
  workflow: WorkflowDefinition,
  currentState: string,
  user: User | null | undefined,
): WorkflowTransition[] {
  return workflow.transitions.filter(
    (t) => canFireFrom(t, currentState) && userCanTransition(user, t),
  );
}

/** Convenience: resolve a state's display label. */
export function stateLabel(
  workflow: WorkflowDefinition,
  name: string,
): string {
  return workflow.states.find((s) => s.name === name)?.label ?? name;
}
