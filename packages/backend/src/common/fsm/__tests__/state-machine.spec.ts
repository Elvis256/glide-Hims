import { BadRequestException } from '@nestjs/common';
import { StateMachine } from '../state-machine';

type Light = 'red' | 'yellow' | 'green';

describe('StateMachine', () => {
  const fsm = new StateMachine<Light>({
    red: ['green'],
    green: ['yellow'],
    yellow: ['red'],
  });

  describe('canTransition', () => {
    it('should allow valid transitions', () => {
      expect(fsm.canTransition('red', 'green')).toBe(true);
      expect(fsm.canTransition('green', 'yellow')).toBe(true);
      expect(fsm.canTransition('yellow', 'red')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(fsm.canTransition('red', 'yellow')).toBe(false);
      expect(fsm.canTransition('green', 'red')).toBe(false);
    });

    it('should allow self-transitions', () => {
      expect(fsm.canTransition('red', 'red')).toBe(true);
      expect(fsm.canTransition('green', 'green')).toBe(true);
    });
  });

  describe('validate', () => {
    it('should not throw for valid transitions', () => {
      expect(() => fsm.validate('red', 'green')).not.toThrow();
    });

    it('should not throw for self-transitions', () => {
      expect(() => fsm.validate('red', 'red')).not.toThrow();
    });

    it('should throw BadRequestException for invalid transitions', () => {
      expect(() => fsm.validate('red', 'yellow')).toThrow(BadRequestException);
      expect(() => fsm.validate('red', 'yellow')).toThrow(
        "Cannot transition from 'red' to 'yellow'",
      );
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return targets for known state', () => {
      expect(fsm.getAllowedTransitions('red')).toEqual(['green']);
    });

    it('should return empty array for terminal state', () => {
      const withTerminal = new StateMachine<'a' | 'b'>({ a: ['b'] });
      expect(withTerminal.getAllowedTransitions('b')).toEqual([]);
    });
  });
});
