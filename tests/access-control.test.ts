import { Clarinet, Tx, Chain, Account, types } from '@hirosystems/clarinet-sdk';
import { expect } from 'vitest';

const contracts = {
  accessControl: 'access-control'
};

export function accessControlTests() {
  Clarinet.test({
    name: "Access Control: Deployer should be initial admin",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const result = chain.callReadOnlyFn(
        contracts.accessControl,
        'has-admin-role',
        [types.principal(deployer.address)],
        deployer.address
      );

      expect(result.result).toBe(types.bool(true));
    }
  });

  Clarinet.test({
    name: "Access Control: Admin can add new admin",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const newAdmin = accounts[1];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'add-admin',
          [types.principal(newAdmin.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Verify new admin has admin role
      const checkResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'has-admin-role',
        [types.principal(newAdmin.address)],
        deployer.address
      );

      expect(checkResult.result).toBe(types.bool(true));
    }
  });

  Clarinet.test({
    name: "Access Control: Non-admin cannot add admin",
    fn(chain: Chain, accounts: Account[]) {
      const user = accounts[1];
      const newAdmin = accounts[2];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'add-admin',
          [types.principal(newAdmin.address)],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(100))); // ERR-UNAUTHORIZED
    }
  });

  Clarinet.test({
    name: "Access Control: Cannot add existing admin",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'add-admin',
          [types.principal(deployer.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(101))); // ERR-ALREADY-ADMIN
    }
  });

  Clarinet.test({
    name: "Access Control: Admin can grant user role",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const user = accounts[1];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'grant-user-role',
          [types.principal(user.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Verify user has role
      const checkResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'has-role',
        [types.principal(user.address)],
        deployer.address
      );

      expect(checkResult.result).toBe(types.bool(true));

      // Verify user role is USER_ROLE (2)
      const roleResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'get-user-role',
        [types.principal(user.address)],
        deployer.address
      );

      expect(roleResult.result).toBe(types.some(types.uint(2)));
    }
  });

  Clarinet.test({
    name: "Access Control: Admin can revoke user role",
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

      // Then revoke it
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'revoke-user-role',
          [types.principal(user.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Verify user no longer has role
      const checkResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'has-role',
        [types.principal(user.address)],
        deployer.address
      );

      expect(checkResult.result).toBe(types.bool(false));
    }
  });

  Clarinet.test({
    name: "Access Control: Admin can remove another admin",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const admin2 = accounts[1];

      // First add admin2
      let block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'add-admin',
          [types.principal(admin2.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Then remove admin2
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'remove-admin',
          [types.principal(admin2.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Verify admin2 no longer has admin role
      const checkResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'has-admin-role',
        [types.principal(admin2.address)],
        deployer.address
      );

      expect(checkResult.result).toBe(types.bool(false));
    }
  });

  Clarinet.test({
    name: "Access Control: Cannot remove self as admin",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'remove-admin',
          [types.principal(deployer.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(103))); // ERR-CANNOT-REMOVE-LAST-ADMIN
    }
  });

  Clarinet.test({
    name: "Access Control: Transfer ownership",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];
      const newOwner = accounts[1];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'transfer-ownership',
          [types.principal(newOwner.address)],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Verify new owner
      const ownerResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'get-contract-owner',
        [],
        deployer.address
      );

      expect(ownerResult.result).toBe(types.principal(newOwner.address));

      // Verify new owner has admin role
      const adminResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'has-admin-role',
        [types.principal(newOwner.address)],
        deployer.address
      );

      expect(adminResult.result).toBe(types.bool(true));
    }
  });

  Clarinet.test({
    name: "Access Control: User can renounce their own role",
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

      // User renounces role
      block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'renounce-role',
          [],
          user.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.ok(types.bool(true)));

      // Verify user no longer has role
      const checkResult = chain.callReadOnlyFn(
        contracts.accessControl,
        'has-role',
        [types.principal(user.address)],
        deployer.address
      );

      expect(checkResult.result).toBe(types.bool(false));
    }
  });

  Clarinet.test({
    name: "Access Control: Admin cannot renounce role (simplified last admin check)",
    fn(chain: Chain, accounts: Account[]) {
      const deployer = accounts[0];

      const block = chain.mineBlock([
        Tx.contractCall(
          contracts.accessControl,
          'renounce-role',
          [],
          deployer.address
        )
      ]);

      expect(block.receipts[0].result).toBe(types.err(types.uint(103))); // ERR-CANNOT-REMOVE-LAST-ADMIN
    }
  });
}