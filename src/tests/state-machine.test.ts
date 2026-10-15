import { TaskStateMachine, InvalidStateTransitionError } from '../core/state-machine';
import { TaskState } from '../core/types';

describe('TaskStateMachine (13 Persistent States)', () => {
  it('allows valid state progression from RECEIVED through to COMPLETED', () => {
    expect(TaskStateMachine.isValidTransition(TaskState.RECEIVED, TaskState.UNDERSTANDING)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.UNDERSTANDING, TaskState.PLANNING)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.PLANNING, TaskState.AUTHORIZATION_CHECK)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.AUTHORIZATION_CHECK, TaskState.READY)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.READY, TaskState.RUNNING)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.RUNNING, TaskState.VERIFYING)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.VERIFYING, TaskState.COMPLETED)).toBe(true);
  });

  it('rejects invalid state transitions with InvalidStateTransitionError', () => {
    expect(TaskStateMachine.isValidTransition(TaskState.RECEIVED, TaskState.COMPLETED)).toBe(false);
    expect(() => {
      TaskStateMachine.assertTransition(TaskState.RECEIVED, TaskState.COMPLETED);
    }).toThrow(InvalidStateTransitionError);

    expect(TaskStateMachine.isValidTransition(TaskState.COMPLETED, TaskState.RUNNING)).toBe(false);
    expect(TaskStateMachine.isValidTransition(TaskState.CANCELLED, TaskState.PLANNING)).toBe(false);
  });

  it('correctly identifies terminal states', () => {
    expect(TaskStateMachine.isTerminal(TaskState.COMPLETED)).toBe(true);
    expect(TaskStateMachine.isTerminal(TaskState.CANCELLED)).toBe(true);
    expect(TaskStateMachine.isTerminal(TaskState.RUNNING)).toBe(false);
    expect(TaskStateMachine.isTerminal(TaskState.WAITING_FOR_USER)).toBe(false);
  });

  it('allows recovery transitions', () => {
    expect(TaskStateMachine.isValidTransition(TaskState.RUNNING, TaskState.RECOVERING)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.RECOVERING, TaskState.RUNNING)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.RECOVERING, TaskState.PLANNING)).toBe(true);
  });

  it('allows waiting for user and resumption transitions', () => {
    expect(TaskStateMachine.isValidTransition(TaskState.RUNNING, TaskState.WAITING_FOR_USER)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.WAITING_FOR_USER, TaskState.READY)).toBe(true);
    expect(TaskStateMachine.isValidTransition(TaskState.WAITING_FOR_USER, TaskState.CANCELLED)).toBe(true);
  });
});
