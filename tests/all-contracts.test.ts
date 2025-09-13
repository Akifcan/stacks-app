import { describe } from 'vitest';
import { accessControlTests } from './access-control.test.js';
import { counterTests } from './counter.test.js';
import { votingSystemTests } from './voting-system.test.js';
import { messageBoardTests } from './message-board.test.js';

describe("Essential Smart Contract Patterns Test Suite", () => {
  describe("Access Control Contract", accessControlTests);
  describe("Counter Contract", counterTests);
  describe("Voting System Contract", votingSystemTests);
  describe("Message Board Contract", messageBoardTests);
});