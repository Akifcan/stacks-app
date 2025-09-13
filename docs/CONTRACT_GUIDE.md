# Contract Guide

This guide provides detailed documentation for each smart contract in the Essential Smart Contract Patterns project.

## Table of Contents

- [Access Control Contract](#access-control-contract)
- [Counter Contract](#counter-contract)
- [Voting System Contract](#voting-system-contract)
- [Message Board Contract](#message-board-contract)

---

## Access Control Contract

**File**: `contracts/access-control.clar`

The Access Control contract provides role-based access control functionality that serves as the foundation for permissions in other contracts.

### Overview

This contract implements a two-tier role system:
- **Admin Role**: Full administrative privileges
- **User Role**: Basic access privileges

The contract deployer automatically becomes the initial admin and contract owner.

### Data Structures

#### Maps

- `admins`: `principal -> bool` - Tracks admin addresses
- `user-roles`: `principal -> uint` - Maps users to their roles

#### Data Variables

- `contract-owner`: `principal` - The current contract owner

#### Constants

- `ADMIN-ROLE`: `u1` - Admin role identifier
- `USER-ROLE`: `u2` - User role identifier

### Functions

#### Read-Only Functions

##### `get-contract-owner()`
Returns the current contract owner.

**Returns**: `principal`

##### `has-admin-role(user: principal)`
Checks if a user has admin privileges.

**Parameters**:
- `user`: Principal to check

**Returns**: `bool`

##### `has-role(user: principal)`
Checks if a user has any role (admin or user).

**Parameters**:
- `user`: Principal to check

**Returns**: `bool`

##### `get-user-role(user: principal)`
Gets the role of a specific user.

**Parameters**:
- `user`: Principal to check

**Returns**: `(optional uint)`

##### `is-authorized(user: principal)`
Checks if a user is authorized (has any role).

**Parameters**:
- `user`: Principal to check

**Returns**: `bool`

#### Public Functions

##### `add-admin(new-admin: principal)`
Adds a new admin. Only existing admins can call this function.

**Parameters**:
- `new-admin`: Principal to grant admin role

**Returns**: `(response bool uint)`

**Errors**:
- `u100`: Unauthorized
- `u101`: Already admin
- `u104`: Invalid principal

##### `remove-admin(admin-to-remove: principal)`
Removes an admin. Cannot remove the last admin.

**Parameters**:
- `admin-to-remove`: Principal to remove admin role from

**Returns**: `(response bool uint)`

**Errors**:
- `u100`: Unauthorized
- `u102`: Not admin
- `u103`: Cannot remove last admin

##### `grant-user-role(user: principal)`
Grants user role to a principal. Only admins can call this.

**Parameters**:
- `user`: Principal to grant user role

**Returns**: `(response bool uint)`

**Errors**:
- `u100`: Unauthorized
- `u104`: Invalid principal

##### `revoke-user-role(user: principal)`
Revokes user role from a principal. Only admins can call this.

**Parameters**:
- `user`: Principal to revoke user role from

**Returns**: `(response bool uint)`

**Errors**:
- `u100`: Unauthorized

##### `renounce-role()`
Allows a user to renounce their own role. Admins cannot renounce if they're the last admin.

**Returns**: `(response bool uint)`

**Errors**:
- `u100`: Unauthorized
- `u103`: Cannot remove last admin

##### `transfer-ownership(new-owner: principal)`
Transfers contract ownership. Only current owner can call this.

**Parameters**:
- `new-owner`: Principal to transfer ownership to

**Returns**: `(response bool uint)`

**Errors**:
- `u100`: Unauthorized
- `u104`: Invalid principal

### Usage Examples

```clarity
;; Check if a user is an admin
(contract-call? .access-control has-admin-role 'SP1HTBVD3S...)

;; Grant user role to someone
(contract-call? .access-control grant-user-role 'SP2ABC...)

;; Add a new admin
(contract-call? .access-control add-admin 'SP3DEF...)
```

---

## Counter Contract

**File**: `contracts/counter.clar`

A simple counter contract with permission controls and administrative features.

### Overview

The Counter contract provides increment/decrement functionality with configurable permission requirements. It includes administrative controls, history tracking, and emergency pause functionality.

### Data Structures

#### Data Variables

- `counter`: `uint` - Current counter value
- `increment-permission-required`: `bool` - Whether increment requires authorization
- `decrement-permission-required`: `bool` - Whether decrement requires authorization
- `contract-paused`: `bool` - Emergency pause state
- `counter-history`: `(list 100 {...})` - Operation history

#### Constants

- `MAX-COUNTER-VALUE`: `u1000000000` - Maximum allowed counter value

### Functions

#### Read-Only Functions

##### `get-counter()`
Returns the current counter value.

**Returns**: `uint`

##### `get-counter-config()`
Returns the current counter configuration.

**Returns**:
```clarity
{
  current-value: uint,
  increment-permission-required: bool,
  decrement-permission-required: bool,
  is-paused: bool,
  max-value: uint
}
```

##### `get-counter-history()`
Returns the complete counter operation history.

**Returns**: `(list 100 {...})`

##### `get-recent-history()`
Returns the last 10 counter operations.

**Returns**: `(list 10 {...})`

##### `can-increment(user: principal)`
Checks if a user can increment the counter.

**Parameters**:
- `user`: Principal to check

**Returns**: `bool`

##### `can-decrement(user: principal)`
Checks if a user can decrement the counter.

**Parameters**:
- `user`: Principal to check

**Returns**: `bool`

#### Public Functions

##### `increment()`
Increments the counter by 1.

**Returns**: `(response uint uint)`

**Errors**:
- `u304`: Counter paused
- `u300`: Unauthorized
- `u301`: Counter overflow

##### `increment-by(amount: uint)`
Increments the counter by a specified amount.

**Parameters**:
- `amount`: Amount to increment

**Returns**: `(response uint uint)`

**Errors**:
- `u304`: Counter paused
- `u300`: Unauthorized
- `u303`: Invalid amount
- `u301`: Counter overflow

##### `decrement()`
Decrements the counter by 1.

**Returns**: `(response uint uint)`

**Errors**:
- `u304`: Counter paused
- `u300`: Unauthorized
- `u302`: Counter underflow

##### `decrement-by(amount: uint)`
Decrements the counter by a specified amount.

**Parameters**:
- `amount`: Amount to decrement

**Returns**: `(response uint uint)`

**Errors**:
- `u304`: Counter paused
- `u300`: Unauthorized
- `u303`: Invalid amount
- `u302`: Counter underflow

##### `reset-counter()` (Admin Only)
Resets the counter to zero.

**Returns**: `(response uint uint)`

**Errors**:
- `u300`: Unauthorized

##### `set-counter(new-value: uint)` (Admin Only)
Sets the counter to a specific value.

**Parameters**:
- `new-value`: New counter value

**Returns**: `(response uint uint)`

**Errors**:
- `u300`: Unauthorized
- `u304`: Counter paused
- `u301`: Counter overflow

##### `set-permission-requirements(increment-req: bool, decrement-req: bool)` (Admin Only)
Configures permission requirements for operations.

**Parameters**:
- `increment-req`: Whether increment requires permission
- `decrement-req`: Whether decrement requires permission

**Returns**: `(response bool uint)`

**Errors**:
- `u300`: Unauthorized

##### `set-contract-paused(paused: bool)` (Admin Only)
Sets the contract pause state.

**Parameters**:
- `paused`: Pause state

**Returns**: `(response bool uint)`

**Errors**:
- `u300`: Unauthorized

##### `emergency-pause()` (Admin Only)
Immediately pauses the contract.

**Returns**: `(response bool uint)`

**Errors**:
- `u300`: Unauthorized

##### `batch-increment(times: uint)` (Admin Only)
Increments the counter multiple times in one transaction.

**Parameters**:
- `times`: Number of times to increment (max 100)

**Returns**: `(response uint uint)`

**Errors**:
- `u300`: Unauthorized
- `u304`: Counter paused
- `u303`: Invalid amount

### Usage Examples

```clarity
;; Basic increment
(contract-call? .counter increment)

;; Increment by specific amount
(contract-call? .counter increment-by u10)

;; Admin operations
(contract-call? .counter reset-counter)
(contract-call? .counter emergency-pause)
```

---

## Voting System Contract

**File**: `contracts/voting-system.clar`

A proposal-based voting system with time-bounded voting periods.

### Overview

The Voting System allows authorized users to create proposals and vote on them. Proposals have configurable duration limits and automatic result calculation.

### Data Structures

#### Maps

- `proposals`: `uint -> {...}` - Stores proposal data
- `votes`: `{proposal-id: uint, voter: principal} -> uint` - Tracks individual votes

#### Data Variables

- `proposal-counter`: `uint` - Next proposal ID
- `min-voting-duration`: `uint` - Minimum voting period in blocks
- `max-voting-duration`: `uint` - Maximum voting period in blocks

#### Constants

- `VOTE-YES`: `u1` - Yes vote identifier
- `VOTE-NO`: `u2` - No vote identifier
- `STATUS-ACTIVE`: `u1` - Active proposal status
- `STATUS-PASSED`: `u2` - Passed proposal status
- `STATUS-FAILED`: `u3` - Failed proposal status

### Functions

#### Read-Only Functions

##### `get-proposal(proposal-id: uint)`
Gets proposal details by ID.

**Parameters**:
- `proposal-id`: Proposal identifier

**Returns**: `(optional {...})`

##### `get-vote(proposal-id: uint, voter: principal)`
Gets a specific user's vote on a proposal.

**Parameters**:
- `proposal-id`: Proposal identifier
- `voter`: Voter's principal

**Returns**: `(optional uint)`

##### `is-proposal-active(proposal-id: uint)`
Checks if a proposal is currently active for voting.

**Parameters**:
- `proposal-id`: Proposal identifier

**Returns**: `bool`

##### `get-proposal-count()`
Returns the total number of proposals created.

**Returns**: `uint`

##### `get-voting-config()`
Returns voting system configuration.

**Returns**:
```clarity
{
  min-duration: uint,
  max-duration: uint
}
```

##### `get-proposal-results(proposal-id: uint)`
Gets the results of a proposal.

**Parameters**:
- `proposal-id`: Proposal identifier

**Returns**:
```clarity
{
  yes-votes: uint,
  no-votes: uint,
  total-votes: uint,
  status: uint,
  passed: bool
}
```

#### Public Functions

##### `create-proposal(title: (string-ascii 100), description: (string-ascii 500), duration-blocks: uint)`
Creates a new voting proposal.

**Parameters**:
- `title`: Proposal title
- `description`: Proposal description
- `duration-blocks`: Voting duration in blocks

**Returns**: `(response uint uint)`

**Errors**:
- `u200`: Unauthorized
- `u206`: Invalid duration

##### `vote(proposal-id: uint, vote-type: uint)`
Casts a vote on a proposal.

**Parameters**:
- `proposal-id`: Proposal to vote on
- `vote-type`: Vote type (1 for yes, 2 for no)

**Returns**: `(response bool uint)`

**Errors**:
- `u200`: Unauthorized
- `u201`: Proposal not found
- `u202`: Proposal ended
- `u203`: Already voted
- `u204`: Invalid vote

##### `finalize-proposal(proposal-id: uint)`
Finalizes a proposal after voting period ends.

**Parameters**:
- `proposal-id`: Proposal to finalize

**Returns**: `(response uint uint)`

**Errors**:
- `u201`: Proposal not found
- `u205`: Proposal still active
- `u202`: Already finalized

##### `update-voting-duration(min-duration: uint, max-duration: uint)` (Admin Only)
Updates voting duration limits.

**Parameters**:
- `min-duration`: Minimum duration in blocks
- `max-duration`: Maximum duration in blocks

**Returns**: `(response bool uint)`

**Errors**:
- `u200`: Unauthorized
- `u206`: Invalid duration

##### `cancel-proposal(proposal-id: uint)` (Admin Only)
Cancels an active proposal.

**Parameters**:
- `proposal-id`: Proposal to cancel

**Returns**: `(response bool uint)`

**Errors**:
- `u200`: Unauthorized
- `u201`: Proposal not found
- `u202`: Proposal ended

### Usage Examples

```clarity
;; Create a proposal
(contract-call? .voting-system create-proposal
  "Increase Block Rewards"
  "Should we increase mining rewards?"
  u1440)

;; Vote on a proposal
(contract-call? .voting-system vote u1 u1) ;; Vote YES on proposal 1

;; Check results
(contract-call? .voting-system get-proposal-results u1)
```

---

## Message Board Contract

**File**: `contracts/message-board.clar`

A discussion board with message threading, moderation, and administrative controls.

### Overview

The Message Board allows users to post messages, reply to messages, and provides moderation capabilities. Admins can configure the board, pin messages, and manage content.

### Data Structures

#### Maps

- `messages`: `uint -> {...}` - Stores message data
- `user-messages`: `principal -> (list 100 uint)` - User's message IDs

#### Data Variables

- `message-counter`: `uint` - Next message ID
- `active-message-count`: `uint` - Count of non-deleted messages
- `board-paused`: `bool` - Board pause state
- `moderation-enabled`: `bool` - Moderation feature state
- `public-posting-allowed`: `bool` - Public posting permission
- `pinned-messages`: `(list 10 uint)` - Pinned message IDs

#### Constants

- `MAX-MESSAGE-LENGTH`: `u500` - Maximum message length
- `MAX-MESSAGES-PER-USER`: `u100` - Max messages per user
- `MAX-TOTAL-MESSAGES`: `u10000` - Total message limit

### Functions

#### Read-Only Functions

##### `get-message(message-id: uint)`
Gets complete message data by ID.

**Parameters**:
- `message-id`: Message identifier

**Returns**: `(optional {...})`

##### `get-message-content(message-id: uint)`
Gets only the message content (quick access).

**Parameters**:
- `message-id`: Message identifier

**Returns**: `(optional (string-utf8 500))`

##### `get-user-messages(user: principal)`
Gets all message IDs for a user.

**Parameters**:
- `user`: User's principal

**Returns**: `(optional (list 100 uint))`

##### `get-recent-messages(count: uint)`
Gets the most recent messages.

**Parameters**:
- `count`: Number of messages to retrieve

**Returns**: `(list ... (optional {...}))`

##### `get-board-stats()`
Gets board statistics and configuration.

**Returns**:
```clarity
{
  total-messages: uint,
  active-messages: uint,
  is-paused: bool,
  moderation-enabled: bool,
  public-posting-allowed: bool
}
```

##### `get-pinned-messages()`
Gets list of pinned message IDs.

**Returns**: `(list 10 uint)`

##### `get-messages-by-author(author: principal)`
Gets message IDs by a specific author.

**Parameters**:
- `author`: Author's principal

**Returns**: `(list 100 uint)`

#### Public Functions

##### `post-message(content: (string-utf8 500), reply-to: (optional uint))`
Posts a new message or reply.

**Parameters**:
- `content`: Message content
- `reply-to`: Optional message ID to reply to

**Returns**: `(response uint uint)`

**Errors**:
- `u406`: Board paused
- `u400`: Unauthorized
- `u402`: Message too long
- `u407`: Too many messages
- `u401`: Reply target not found

##### `edit-message(message-id: uint, new-content: (string-utf8 500))`
Edits a message (author or admin only).

**Parameters**:
- `message-id`: Message to edit
- `new-content`: New message content

**Returns**: `(response bool uint)`

**Errors**:
- `u401`: Message not found
- `u405`: Message already deleted
- `u400`: Unauthorized
- `u402`: Message too long

##### `delete-message(message-id: uint)`
Deletes a message (author or admin only).

**Parameters**:
- `message-id`: Message to delete

**Returns**: `(response bool uint)`

**Errors**:
- `u401`: Message not found
- `u405`: Already deleted
- `u400`: Unauthorized

##### `pin-message(message-id: uint)` (Admin Only)
Pins a message.

**Parameters**:
- `message-id`: Message to pin

**Returns**: `(response bool uint)`

**Errors**:
- `u400`: Unauthorized
- `u401`: Message not found

##### `unpin-message(message-id: uint)` (Admin Only)
Unpins a message.

**Parameters**:
- `message-id`: Message to unpin

**Returns**: `(response bool uint)`

**Errors**:
- `u400`: Unauthorized

##### `configure-board(paused: bool, moderation: bool, public-posting: bool)` (Admin Only)
Configures board settings.

**Parameters**:
- `paused`: Pause state
- `moderation`: Moderation enabled
- `public-posting`: Public posting allowed

**Returns**: `(response bool uint)`

**Errors**:
- `u400`: Unauthorized

##### `emergency-pause()` (Admin Only)
Immediately pauses the board.

**Returns**: `(response bool uint)`

**Errors**:
- `u400`: Unauthorized

### Usage Examples

```clarity
;; Post a message
(contract-call? .message-board post-message
  u"Hello, world!"
  none)

;; Reply to a message
(contract-call? .message-board post-message
  u"Great post!"
  (some u1))

;; Pin a message (admin)
(contract-call? .message-board pin-message u1)

;; Configure board (admin)
(contract-call? .message-board configure-board false true true)
```

---

## Error Codes Reference

### Access Control Contract (100-199)
- `u100`: Unauthorized
- `u101`: Already admin
- `u102`: Not admin
- `u103`: Cannot remove last admin
- `u104`: Invalid principal

### Voting System Contract (200-299)
- `u200`: Unauthorized
- `u201`: Proposal not found
- `u202`: Proposal ended
- `u203`: Already voted
- `u204`: Invalid vote
- `u205`: Proposal active
- `u206`: Invalid duration

### Counter Contract (300-399)
- `u300`: Unauthorized
- `u301`: Counter overflow
- `u302`: Counter underflow
- `u303`: Invalid amount
- `u304`: Counter paused

### Message Board Contract (400-499)
- `u400`: Unauthorized
- `u401`: Message not found
- `u402`: Message too long
- `u403`: Empty message
- `u404`: Invalid message ID
- `u405`: Message already deleted
- `u406`: Board paused
- `u407`: Too many messages

---

## Integration Patterns

### Cross-Contract Authorization

All contracts (except Access Control) use the Access Control contract for authorization:

```clarity
;; Check if user is authorized
(define-private (is-authorized (user principal))
  (contract-call? .access-control is-authorized user))

;; Check if user is admin
(define-private (is-admin (user principal))
  (contract-call? .access-control has-admin-role user))
```

### Common Administrative Patterns

1. **Emergency Pause**: All contracts implement emergency pause functionality
2. **Permission Configuration**: Flexible permission requirements
3. **History Tracking**: Important operations are logged
4. **Input Validation**: All inputs are validated before processing

### Best Practices

1. **Always check authorization** before performing sensitive operations
2. **Use proper error codes** for different failure conditions
3. **Validate inputs** to prevent invalid state changes
4. **Implement emergency controls** for critical situations
5. **Track important events** for auditability