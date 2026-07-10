import { BadRequestException } from '@nestjs/common';

/**
 * Generic typed finite state machine.
 *
 * Define the allowed transitions as a record mapping each source state to its
 * valid target states. The FSM can then validate or enforce transitions.
 */
export class StateMachine<S extends string> {
  constructor(private readonly transitions: Partial<Record<S, S[]>>) {}

  /** Returns true if transitioning from `from` to `to` is allowed. */
  canTransition(from: S, to: S): boolean {
    if (from === to) return true; // self-transition is always a no-op
    const allowed = this.transitions[from];
    return !!allowed && allowed.includes(to);
  }

  /**
   * Throws BadRequestException if the transition is not allowed.
   * Self-transitions (from === to) are silently accepted.
   */
  validate(from: S, to: S): void {
    if (from === to) return;
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(`Cannot transition from '${from}' to '${to}'`);
    }
  }

  /** Returns the list of states reachable from the given state. */
  getAllowedTransitions(from: S): S[] {
    return this.transitions[from] ?? [];
  }
}
