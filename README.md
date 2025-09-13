# Essential Smart Contract Patterns

A comprehensive collection of production-ready Clarity smart contracts demonstrating essential patterns for Stacks blockchain development. This project provides battle-tested implementations of common smart contract functionality with complete test coverage, deployment scripts, and comprehensive documentation.

## 🏗️ Project Overview

This project implements four foundational smart contract patterns that serve as building blocks for more complex decentralized applications:

### 📋 Smart Contracts

1. **Access Control Contract** (`access-control.clar`)
   - Role-based permission system with admin and user roles
   - Contract ownership management
   - Secure role assignment and revocation
   - Foundation for other contract permissions

2. **Simple Voting System** (`voting-system.clar`)
   - Proposal creation and management
   - Yes/No voting mechanism
   - Time-bounded voting periods
   - Vote counting and result calculation

3. **Counter Contract** (`counter.clar`)
   - Increment/decrement functionality with permission controls
   - Configurable permission requirements
   - Emergency pause mechanism
   - Operation history tracking

4. **Message Board** (`message-board.clar`)
   - Message posting and threading (reply functionality)
   - Message editing and deletion
   - Admin moderation capabilities
   - Pinned messages and board configuration

## 🚀 Quick Start

### Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) (v2.0+)
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd essential-smart-contract-patterns

# Install dependencies
npm install

# Run tests to verify setup
npm run test:all
```

### Running Tests

```bash
# Run all tests
npm run test:all

# Run integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Generate test reports with coverage
npm run test:reports
```

## 📝 Contract Documentation

### Access Control Contract

The foundation contract that provides role-based access control for all other contracts.

**Key Functions:**
- `add-admin` - Add a new admin (admin only)
- `remove-admin` - Remove an admin (admin only, cannot remove last admin)
- `grant-user-role` - Grant user role to an address (admin only)
- `revoke-user-role` - Revoke user role (admin only)
- `transfer-ownership` - Transfer contract ownership (owner only)

### Voting System Contract

Implements a simple proposal-based voting system with time-bounded voting periods.

**Key Functions:**
- `create-proposal` - Create a new voting proposal (authorized users only)
- `vote` - Cast a vote (yes/no) on a proposal (authorized users only)
- `finalize-proposal` - Calculate final results after voting period ends
- `cancel-proposal` - Cancel a proposal (admin only)

### Counter Contract

A simple counter with permission-controlled operations and administrative features.

**Key Functions:**
- `increment` / `increment-by` - Increase counter value
- `decrement` / `decrement-by` - Decrease counter value
- `reset-counter` - Reset to zero (admin only)
- `set-counter` - Set to specific value (admin only)
- `emergency-pause` - Pause all operations (admin only)

### Message Board Contract

A discussion board with message threading, moderation, and administrative controls.

**Key Functions:**
- `post-message` - Post a new message or reply
- `edit-message` - Edit your own message (author or admin)
- `delete-message` - Delete a message (author or admin)
- `pin-message` / `unpin-message` - Pin important messages (admin only)
- `configure-board` - Configure board settings (admin only)

## 🚀 Deployment

### Testnet Deployment

```bash
# Set environment variables
export STACKS_PRIVATE_KEY="your_testnet_private_key"
export STACKS_ADDRESS="your_testnet_address"

# Deploy to testnet
npm run deploy:testnet

# Initialize contracts with default settings
npm run initialize:testnet
```

### Mainnet Deployment

```bash
# Set environment variables
export STACKS_PRIVATE_KEY="your_mainnet_private_key"
export STACKS_ADDRESS="your_mainnet_address"
export DEPLOY_CONFIRMATION="YES_I_WANT_TO_DEPLOY_TO_MAINNET"

# Deploy to mainnet (be careful!)
npm run deploy:mainnet

# Initialize contracts
npm run initialize:mainnet
```

## 🧪 Testing Strategy

Our testing approach ensures contract reliability through:

- **Unit Tests**: Individual function testing for each contract
- **Integration Tests**: Cross-contract interaction testing
- **Edge Case Testing**: Boundary conditions and error scenarios
- **Permission Testing**: Access control verification
- **State Consistency Testing**: Ensure state remains valid across operations

## 📁 Project Structure

```
stacks-app/
├── contracts/
│   ├── access-control.clar      # Role-based access control
│   ├── counter.clar             # Counter with permissions
│   ├── voting-system.clar       # Proposal voting system
│   └── message-board.clar       # Discussion board
├── tests/
│   ├── access-control.test.ts   # Access control unit tests
│   ├── counter.test.ts          # Counter unit tests
│   ├── voting-system.test.ts    # Voting system unit tests
│   ├── message-board.test.ts    # Message board unit tests
│   ├── integration.test.ts      # Cross-contract integration tests
│   └── all-contracts.test.ts    # Test suite runner
├── scripts/
│   ├── deploy-testnet.ts        # Testnet deployment script
│   ├── deploy-mainnet.ts        # Mainnet deployment script
│   └── initialize-contracts.ts  # Contract initialization
├── deployments/                 # Deployment artifacts
├── docs/                        # Detailed documentation
├── Clarinet.toml               # Clarinet configuration
└── package.json                # Project dependencies and scripts
```

## 🔒 Security Features

All contracts implement comprehensive security measures:

- **Access Control**: Role-based permissions with proper authorization checks
- **Input Validation**: All inputs are validated for type and range
- **Overflow Protection**: Safe arithmetic operations with bounds checking
- **Reentrancy Protection**: State changes occur before external calls
- **Emergency Controls**: Admin pause functionality for critical situations
- **Error Handling**: Comprehensive error codes and proper error propagation

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STACKS_PRIVATE_KEY` | Your Stacks private key | Yes |
| `STACKS_ADDRESS` | Your Stacks address | Yes |
| `STACKS_NETWORK` | Network (testnet/mainnet) | Optional |
| `DEPLOY_CONFIRMATION` | Mainnet deployment safety check | Mainnet only |
| `CREATE_SAMPLE_DATA` | Create sample data during initialization | Optional |

## 📚 Additional Documentation

- [Contract Guide](docs/CONTRACT_GUIDE.md) - Detailed contract documentation
- [Deployment Guide](docs/DEPLOYMENT.md) - Step-by-step deployment instructions
- [Security Guide](docs/SECURITY.md) - Security considerations and best practices
- [API Reference](docs/API_REFERENCE.md) - Complete function reference

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and ensure all tests pass before submitting a pull request.

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [documentation](docs/)
2. Review the [test cases](tests/) for usage examples
3. Open an issue on GitHub
4. Join the Stacks community for help

## 🎯 Roadmap

Future enhancements planned:
- Additional contract patterns (token contracts, NFTs, DeFi primitives)
- Advanced governance mechanisms
- Multi-signature wallet integration
- Oracle integration patterns
- Cross-contract communication examples

---

**Built with ❤️ for the Stacks ecosystem**