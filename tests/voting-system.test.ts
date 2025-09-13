import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet-sdk';
import { expect } from 'vitest';

const contracts = {
  votingSystem: 'voting-system',
  accessControl: 'access-control'
};

export function votingSystemTests() {
  Clarinet.test({
    name: "Voting System: Admin can create proposal",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal for voting"),
            types.uint(1440) // 10 days in blocks
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Check proposal was created
      const proposalResult = chain.callReadOnlyFn(
        contracts.votingSystem,
        'get-proposal',
        [types.uint(1)],
        deployer.address
      );

      expect(proposalResult.result).not.toBe(types.none());
    }
  });

  Clarinet.test({
    name: "Voting System: Unauthorized user cannot create proposal",
    fn(chain: Chain, accounts: Account[]) {
      const user = accounts[1];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(200))); // ERR-UNAUTHORIZED
    }
  });

  Clarinet.test({
    name: "Voting System: Cannot create proposal with invalid duration",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Too short duration
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(100) // Less than minimum
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(206))); // ERR-INVALID-DURATION

      // Too long duration
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(10000) // More than maximum
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(206))); // ERR-INVALID-DURATION
    }
  });

  Clarinet.test({
    name: "Voting System: Authorized user can vote yes on proposal",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // Grant user role
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Create proposal
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Vote yes
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(1)], // VOTE-YES = 1
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Check vote was recorded
      const voteResult = chain.callReadOnlyFn(
        contracts.votingSystem,
        'get-vote',
        [types.uint(1), types.principal(user.address)],
        deployer.address
      );

      expect(voteResult.result).toBe(types.some(types.uint(1)));
    }
  });

  Clarinet.test({
    name: "Voting System: Authorized user can vote no on proposal",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // Grant user role
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          deployer.address
        )
      ]);

      // Create proposal
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      // Vote no
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(2)], // VOTE-NO = 2
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Check vote was recorded
      const voteResult = chain.callReadOnlyFn(
        contracts.votingSystem,
        'get-vote',
        [types.uint(1), types.principal(user.address)],
        deployer.address
      );

      expect(voteResult.result).toBe(types.some(types.uint(2)));
    }
  });

  Clarinet.test({
    name: "Voting System: Cannot vote twice on same proposal",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // Grant user role and create proposal
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          deployer.address
        ),
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      // First vote
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(1)],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Second vote should fail
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(2)],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(203))); // ERR-ALREADY-VOTED
    }
  });

  Clarinet.test({
    name: "Voting System: Cannot vote with invalid vote type",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // Grant user role and create proposal
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          deployer.address
        ),
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      // Vote with invalid type
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(3)], // Invalid vote type
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(204))); // ERR-INVALID-VOTE
    }
  });

  Clarinet.test({
    name: "Voting System: Unauthorized user cannot vote",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // Create proposal
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      // Try to vote without authorization
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(1)],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(200))); // ERR-UNAUTHORIZED
    }
  });

  Clarinet.test({
    name: "Voting System: Cannot vote on non-existent proposal",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(999), types.uint(1)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(201))); // ERR-PROPOSAL-NOT-FOUND
    }
  });

  Clarinet.test({
    name: "Voting System: Admin can cancel proposal",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Create proposal
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Cancel proposal
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'cancel-proposal',
          [types.uint(1)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));
    }
  });

  Clarinet.test({
    name: "Voting System: Admin can update voting duration limits",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'update-voting-duration',
          [types.uint(100), types.uint(5000)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Check updated config
      const configResult = chain.callReadOnlyFn(
        contracts.votingSystem,
        'get-voting-config',
        [],
        deployer.address
      );

      expect(configResult.result).toContain('min-duration');
      expect(configResult.result).toContain('max-duration');
    }
  });

  Clarinet.test({
    name: "Voting System: Get proposal count returns correct value",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Initial count should be 0
      let result = chain.callReadOnlyFn(
        contracts.votingSystem,
        'get-proposal-count',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(0));

      // Create a proposal
      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      // Count should now be 1
      result = chain.callReadOnlyFn(
        contracts.votingSystem,
        'get-proposal-count',
        [],
        deployer.address
      );

      expect(result.result).toBe(types.uint(1));
    }
  });

  Clarinet.test({
    name: "Voting System: Check proposal is active works correctly",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Create proposal
      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Test Proposal"),
            types.ascii("This is a test proposal"),
            types.uint(1440)
          ],
          deployer.address
        )
      ]);

      // Check if proposal is active
      const result = chain.callReadOnlyFn(
        contracts.votingSystem,
        'is-proposal-active',
        [types.uint(1)],
        deployer.address
      );

      expect(result.result).toBe(types.bool(true));
    }
  });
}