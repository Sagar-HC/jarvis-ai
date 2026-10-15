import { TaskState } from './types';

export class InvalidStateTransitionError extends Error {
  constructor(public fromState: TaskState, public toState: TaskState, public reason?: string) {
    super(`Invalid task state transition from '${fromState}' to '${toState}'${reason ? `: ${reason}` : ''}`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Valid transitions table for JARVIS 13-state engine
 */
const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.RECEIVED]: [
    TaskState.UNDERSTANDING,
    TaskState.CANCELLED,
    TaskState.FAILED
  ],
  [TaskState.UNDERSTANDING]: [
    TaskState.PLANNING,
    TaskState.WAITING_FOR_USER,
    TaskState.CANCELLED,
    TaskState.FAILED
  ],
  [TaskState.PLANNING]: [
    TaskState.AUTHORIZATION_CHECK,
    TaskState.READY,
    TaskState.WAITING_FOR_USER,
    TaskState.CANCELLED,
    TaskState.FAILED
  ],
  [TaskState.AUTHORIZATION_CHECK]: [
    TaskState.READY,
    TaskState.WAITING_FOR_USER,
    TaskState.CANCELLED,
    TaskState.FAILED
  ],
  [TaskState.WAITING_FOR_USER]: [
    TaskState.READY,
    TaskState.RUNNING,
    TaskState.PLANNING,
    TaskState.CANCELLED,
    TaskState.FAILED
  ],
  [TaskState.READY]: [
    TaskState.RUNNING,
    TaskState.WAITING_FOR_USER,
    TaskState.CANCELLED,
    TaskState.FAILED
  ],
  [TaskState.RUNNING]: [
    TaskState.READY,
    TaskState.VERIFYING,
    TaskState.RECOVERING,
    TaskState.WAITING_FOR_USER,
    TaskState.PARTIALLY_COMPLETED,
    TaskState.COMPLETED,
    TaskState.CANCELLED,
    TaskState.FAILED
  ],
  [TaskState.VERIFYING]: [
    TaskState.RUNNING,
    TaskState.RECOVERING,
    TaskState.WAITING_FOR_USER,
    TaskState.PARTIALLY_COMPLETED,
    TaskState.COMPLETED,
    TaskState.FAILED,
    TaskState.CANCELLED
  ],
  [TaskState.RECOVERING]: [
    TaskState.RUNNING,
    TaskState.PLANNING,
    TaskState.WAITING_FOR_USER,
    TaskState.PARTIALLY_COMPLETED,
    TaskState.FAILED,
    TaskState.CANCELLED
  ],
  [TaskState.PARTIALLY_COMPLETED]: [
    TaskState.PLANNING,
    TaskState.RUNNING,
    TaskState.COMPLETED,
    TaskState.FAILED,
    TaskState.CANCELLED
  ],
  [TaskState.COMPLETED]: [],
  [TaskState.FAILED]: [
    TaskState.RECOVERING // Allow manual or policy-guided restart/retry from failure
  ],
  [TaskState.CANCELLED]: []
};

export class TaskStateMachine {
  /**
   * Checks whether a transition between two states is valid
   */
  public static isValidTransition(from: TaskState, to: TaskState): boolean {
    if (from === to) return true; // Idempotent same-state update
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Validates and asserts a transition; throws InvalidStateTransitionError if invalid
   */
  public static assertTransition(from: TaskState, to: TaskState, reason?: string): void {
    if (!this.isValidTransition(from, to)) {
      throw new InvalidStateTransitionError(from, to, reason);
    }
  }

  /**
   * Returns whether a state is terminal
   */
  public static isTerminal(state: TaskState): boolean {
    return state === TaskState.COMPLETED || state === TaskState.CANCELLED;
  }

  /**
   * Returns list of allowed next states from given state
   */
  public static getAllowedNextStates(state: TaskState): TaskState[] {
    return VALID_TRANSITIONS[state] || [];
  }
}
