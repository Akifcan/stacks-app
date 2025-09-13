import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet-sdk';
import { expect } from 'vitest';

const contracts = {
  messageBoard: 'message-board',
  accessControl: 'access-control'
};

export function messageBoardTests() {
  Clarinet.test({
    name: "Message Board: Admin can post message when public posting disabled",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Hello, this is my first message!"),
            types.none()
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Check message was created
      const messageResult = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-message',
        [types.uint(1)],
        deployer.address
      );

      expect(messageResult.result).not.toBe(types.none());
    }
  });

  Clarinet.test({
    name: "Message Board: Authorized user can post message",
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

      // Post message
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Hello from user!"),
            types.none()
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
    }
  });

  Clarinet.test({
    name: "Message Board: Unauthorized user cannot post when public posting disabled",
    fn(chain: Chain, accounts: Account[]) {
      const user = accounts[1];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Hello from unauthorized user!"),
            types.none()
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(400))); // ERR-UNAUTHORIZED
    }
  });

  Clarinet.test({
    name: "Message Board: Anyone can post when public posting enabled",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      // Enable public posting
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'configure-board',
          [types.bool(false), types.bool(true), types.bool(true)], // paused, moderation, public-posting
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Now unauthorized user can post
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Hello from public user!"),
            types.none()
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));
    }
  });

  Clarinet.test({
    name: "Message Board: Cannot post empty message",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8(""),
            types.none()
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(402))); // ERR-MESSAGE-TOO-LONG (validation fails)
    }
  });

  Clarinet.test({
    name: "Message Board: Cannot post when board is paused",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Pause board
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'configure-board',
          [types.bool(true), types.bool(true), types.bool(false)], // paused, moderation, public-posting
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Try to post message
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Hello!"),
            types.none()
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(406))); // ERR-BOARD-PAUSED
    }
  });

  Clarinet.test({
    name: "Message Board: User can reply to message",
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

      // Post original message
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Original message"),
            types.none()
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Post reply
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("This is a reply"),
            types.some(types.uint(1)) // Reply to message 1
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(2)));
    }
  });

  Clarinet.test({
    name: "Message Board: Cannot reply to non-existent message",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Reply to nowhere"),
            types.some(types.uint(999)) // Non-existent message
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(401))); // ERR-MESSAGE-NOT-FOUND
    }
  });

  Clarinet.test({
    name: "Message Board: Author can edit their own message",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Post message
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Original content"),
            types.none()
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Edit message
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'edit-message',
          [
            types.uint(1),
            types.utf8("Edited content")
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Check content was updated
      const messageResult = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-message-content',
        [types.uint(1)],
        deployer.address
      );

      expect(messageResult.result).toBe(types.some(types.utf8("Edited content")));
    }
  });

  Clarinet.test({
    name: "Message Board: Non-author cannot edit message",
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

      // Post message as deployer
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Original content"),
            types.none()
          ],
          deployer.address
        )
      ]);

      // Try to edit as user
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'edit-message',
          [
            types.uint(1),
            types.utf8("Hacked content")
          ],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(400))); // ERR-UNAUTHORIZED
    }
  });

  Clarinet.test({
    name: "Message Board: Author can delete their own message",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Post message
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Message to be deleted"),
            types.none()
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.uint(1)));

      // Delete message
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'delete-message',
          [types.uint(1)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Check message content is no longer accessible
      const contentResult = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-message-content',
        [types.uint(1)],
        deployer.address
      );

      expect(contentResult.result).toBe(types.none());
    }
  });

  Clarinet.test({
    name: "Message Board: Cannot delete already deleted message",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Post and delete message
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Message to be deleted"),
            types.none()
          ],
          deployer.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'delete-message',
          [types.uint(1)],
          deployer.address
        )
      ]);

      // Try to delete again
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'delete-message',
          [types.uint(1)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(405))); // ERR-MESSAGE-ALREADY-DELETED
    }
  });

  Clarinet.test({
    name: "Message Board: Admin can pin message",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Post message
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Important message"),
            types.none()
          ],
          deployer.address
        )
      ]);

      // Pin message
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'pin-message',
          [types.uint(1)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Check pinned messages
      const pinnedResult = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-pinned-messages',
        [],
        deployer.address
      );

      // Should contain our message ID
      expect(pinnedResult.result).toContain(types.uint(1));
    }
  });

  Clarinet.test({
    name: "Message Board: Admin can unpin message",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Post and pin message
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Important message"),
            types.none()
          ],
          deployer.address
        ),
        Tx.contractCall(
          contracts.messageBoard,
          'pin-message',
          [types.uint(1)],
          deployer.address
        )
      ]);

      // Unpin message
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'unpin-message',
          [types.uint(1)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));
    }
  });

  Clarinet.test({
    name: "Message Board: Emergency pause works",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Emergency pause
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'emergency-pause',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Try to post message after pause
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Should not work"),
            types.none()
          ],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(406))); // ERR-BOARD-PAUSED
    }
  });

  Clarinet.test({
    name: "Message Board: Get board stats returns correct information",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      // Check initial stats
      let statsResult = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-board-stats',
        [],
        deployer.address
      );

      expect(statsResult.result).toContain('total-messages');
      expect(statsResult.result).toContain('active-messages');
      expect(statsResult.result).toContain('is-paused');

      // Post a message
      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.messageBoard,
          'post-message',
          [
            types.utf8("Test message"),
            types.none()
          ],
          deployer.address
        )
      ]);

      // Check updated stats
      statsResult = chain.callReadOnlyFn(
        contracts.messageBoard,
        'get-board-stats',
        [],
        deployer.address
      );

      expect(statsResult.result).toContain('total-messages');
    }
  });
}