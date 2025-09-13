import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet-sdk';
import { expect } from 'vitest';

const contracts = {
  counter: 'counter',
  accessControl: 'access-control'
};

export function counterTests() {
  Clarinet.test({
    name: "Counter: Initial counter value should be 0",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(0));
    }
  });

  Clarinet.test({
    name: "Counter: Admin can increment counter",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Check counter value
      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(1));
    }
  });

  Clarinet.test({
    name: "Counter: Admin can increment by specific amount",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment-by',
          [types.uint(5)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(5)));

      // Check counter value
      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(5));
    }
  });

  Clarinet.test({
    name: "Counter: Admin can decrement counter",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // First increment to have something to decrement
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment-by',
          [types.uint(10)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(10)));

      // Now decrement
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'decrement',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(9)));

      // Check counter value
      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(9));
    }
  });

  Clarinet.test({
    name: "Counter: Cannot decrement below zero",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'decrement',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(302))); // ERR-COUNTER-UNDERFLOW
    }
  });

  Clarinet.test({
    name: "Counter: Admin can reset counter",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // First increment
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment-by',
          [types.uint(100)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(100)));

      // Reset counter
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'reset-counter',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(0)));

      // Check counter value
      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(0));
    }
  });

  Clarinet.test({
    name: "Counter: Admin can set counter to specific value",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'set-counter',
          [types.uint(42)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(42)));

      // Check counter value
      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(42));
    }
  });

  Clarinet.test({
    name: "Counter: Cannot set counter above maximum value",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'set-counter',
          [types.uint(1000000001)], // Above MAX_COUNTER_VALUE
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(301))); // ERR-COUNTER-OVERFLOW
    }
  });

  Clarinet.test({
    name: "Counter: Non-admin user can increment if permissions allow",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // First grant user role
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // User increments counter
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
    }
  });

  Clarinet.test({
    name: "Counter: Unauthorized user cannot increment when permissions required",
    fn(chain: Chain, accounts: Account[]) {
      const user = accounts[1];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(300))); // ERR-UNAUTHORIZED
    }
  });

  Clarinet.test({
    name: "Counter: Admin can pause contract",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Pause contract
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'set-contract-paused',
          [types.bool(true)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Try to increment while paused
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(304))); // ERR-COUNTER-PAUSED
    }
  });

  Clarinet.test({
    name: "Counter: Admin can change permission requirements",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // Set permissions to not required
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'set-permission-requirements',
          [types.bool(false), types.bool(false)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Now unauthorized user should be able to increment
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
    }
  });

  Clarinet.test({
    name: "Counter: Emergency pause works",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Emergency pause
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'emergency-pause',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Try to increment after emergency pause
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(304))); // ERR-COUNTER-PAUSED
    }
  });

  Clarinet.test({
    name: "Counter: Batch increment works",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'batch-increment',
          [types.uint(10)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(10)));

      // Check counter value
      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(10));
    }
  });

  Clarinet.test({
    name: "Counter: Cannot increment with zero amount",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment-by',
          [types.uint(0)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(303))); // ERR-INVALID-AMOUNT
    }
  });

  Clarinet.test({
    name: "Counter: Get counter config returns correct values",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter-config',
        [],
        deployer.address
      );

      // Should return a tuple with config values
      expect(result.result).toContain('current-value');
    }
  });
}