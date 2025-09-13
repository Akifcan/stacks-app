import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet-sdk';
import { expect } from 'vitest';

const contracts = {
  accessControl: 'access-control',
  counter: 'counter',
  votingSystem: 'voting-system',
  messageBoard: 'message-board'
};

export function integrationTests() {
  Clarinet.test({
    name: "Integration: Complete workflow with all contracts",
    fn(chain: Chain, accounts: Account[]) {
      const admin = accounts[0];
      const user1 = accounts[1];
      const user2 = accounts[2];

      // Step 1: Admin grants roles to users
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user1.address)],
          admin.address
        ),
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user2.address)],
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));
      expect(block.receipts[1].result).toBe(types.ok(types.bool(true)));

      // Step 2: Users interact with counter
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment-by',
          [types.uint(5)],
          user1.address
        ),
        Tx.contractCall(
          contracts.counter,
          'increment-by',
          [types.uint(3)],
          user2.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(5)));
      expect(block.receipts[1].result).toBe(types.ok(types.uint(8)));

      // Step 3: Admin creates a voting proposal about counter management
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Counter Reset Proposal"),
            types.ascii("Should we reset the counter to zero?"),
            types.uint(1440) // 10 days
          ],
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Step 4: Users vote on the proposal
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(1)], // Vote YES
          user1.address
        ),
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(2)], // Vote NO
          user2.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));
      expect(block.receipts[1].result).toBe(types.ok(types.bool(true)));

      // Step 5: Users post messages about the voting
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("I voted YES on the counter reset proposal!"),
            types.none()
          ],
          user1.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("I disagree and voted NO. The counter should stay."),
            types.some(types.uint(1)) // Reply to first message
          ],
          user2.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
      expect(block.receipts[1].result).toBe(types.ok(types.uint(2)));

      // Step 6: Admin pins the important message and resets counter based on voting results
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'pin-message',
          [types.uint(1)],
          admin.address
        ),
        // Since user1 voted YES and we have a tie (1 yes, 1 no), let's say admin decides to reset
        Tx.contractCall(
          contracts.counter,
          'reset-counter',
          [],
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));
      expect(block.receipts[1].result).toBe(types.ok(types.uint(0)));

      // Step 7: Verify final state

      // Check counter is reset
      let result = chain.callReadOnlyFn(
        contracts.counter,
        'get-counter',
        [],
        admin.address
      );
      expect(result.result).toBe(types.uint(0));

      // Check voting proposal exists
      result = chain.callReadOnlyFn(
        contracts.votingSystem,
        'get-proposal',
        [types.uint(1)],
        admin.address
      );
      expect(result.result).not.toBe(types.none());

      // Check messages exist
      result = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-message',
        [types.uint(1)],
        admin.address
      );
      expect(result.result).not.toBe(types.none());

      // Check pinned messages
      result = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-pinned-messages',
        [],
        admin.address
      );
      expect(result.result).toContain(types.uint(1));
    }
  });

  Clarinet.test({
    name: "Integration: Role revocation affects all contracts",
    fn(chain: Chain, accounts: Account[]) {
      const admin = accounts[0];
      const user = accounts[1];

      // Grant user role
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // User can initially use all contracts
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          user.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("I can post messages!"),
            types.none()
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
      expect(block.receipts[1].result).toBe(types.ok(types.uint(1)));

      // Admin revokes user role
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'revoke-user-role',
          [types.principal(user.address)],
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // User can no longer use contracts requiring authorization
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          user.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("This should fail"),
            types.none()
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(300))); // ERR-UNAUTHORIZED
      expect(block.receipts[1].result).toBe(types.err(types.uint(400))); // ERR-UNAUTHORIZED
    }
  });

  Clarinet.test({
    name: "Integration: Emergency pause affects multiple contracts",
    fn(chain: Chain, accounts: Account[]) {
      const admin = accounts[0];
      const user = accounts[1];

      // Grant user role
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          admin.address
        )
      ]);

      // Test normal operations work
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          user.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Normal operation"),
            types.none()
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
      expect(block.receipts[1].result).toBe(types.ok(types.uint(1)));

      // Admin triggers emergency pause on both contracts
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'emergency-pause',
          [],
          admin.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'emergency-pause',
          [],
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));
      expect(block.receipts[1].result).toBe(types.ok(types.bool(true)));

      // Operations should now fail due to pause
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.counter,
          'increment',
          [],
          user.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("This should fail"),
            types.none()
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(304))); // ERR-COUNTER-PAUSED
      expect(block.receipts[1].result).toBe(types.err(types.uint(406))); // ERR-BOARD-PAUSED
    }
  });

  Clarinet.test({
    name: "Integration: Cross-contract proposal about message board moderation",
    fn(chain: Chain, accounts: Account[]) {
      const admin = accounts[0];
      const moderator = accounts[1];
      const user = accounts[2];

      // Setup: Grant roles
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'add-admin',
          [types.principal(moderator.address)],
          admin.address
        ),
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          admin.address
        )
      ]);

      // Create proposal about enabling public posting
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'create-proposal',
          [
            types.ascii("Enable Public Posting"),
            types.ascii("Should we allow public posting on message board?"),
            types.uint(1440)
          ],
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Admin and moderator vote YES
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(1)], // YES
          admin.address
        ),
        Tx.contractCall(
          contracts.votingSystem,
          'vote',
          [types.uint(1), types.uint(1)], // YES
          moderator.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));
      expect(block.receipts[1].result).toBe(types.ok(types.bool(true)));

      // Based on voting results, admin enables public posting
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'configure-board',
          [types.bool(false), types.bool(true), types.bool(true)], // not paused, moderation enabled, public posting enabled
          admin.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Verify anyone can now post (even without authorization)
      const unauthorizedUser = accounts[3]; // This user has no roles

      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("I can post publicly now!"),
            types.none()
          ],
          unauthorizedUser.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
    }
  });
}