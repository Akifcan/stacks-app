#!/usr/bin/env node

/**
 * Essential Smart Contract Patterns - Contract Initialization Script
 *
 * This script initializes deployed contracts with default settings and configurations.
 * Run this after deploying contracts to set up initial states and permissions.
 */

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  StacksTestnet,
  StacksMainnet,
  stringAsciiCV,
  stringUtf8CV,
  uintCV,
  boolCV,
  principalCV,
  noneCV
} from '@stacks/transactions';
import { StacksNetwork } from '@stacks/network';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const NETWORK_TYPE = process.env.STACKS_NETWORK || 'testnet';
const NETWORK = NETWORK_TYPE === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
const PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY || '';
const SENDER_ADDRESS = process.env.STACKS_ADDRESS || '';

if (!PRIVATE_KEY) {
  console.error('❌ STACKS_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

if (!SENDER_ADDRESS) {
  console.error('❌ STACKS_ADDRESS environment variable is required');
  process.exit(1);
}

/**
 * Contract initialization configuration
 */
const INITIALIZATION_CONFIG = {
  counter: {
    // Set permission requirements (increment requires permission, decrement requires permission)
    permissionRequirements: { increment: true, decrement: true },
    // Set initial counter value (optional)
    initialValue: 0,
    // Pause state
    initialPaused: false
  },
  votingSystem: {
    // Set voting duration limits (min: 1 day, max: 30 days in blocks)
    minVotingDuration: 144,  // ~1 day
    maxVotingDuration: 4320  // ~30 days
  },
  messageBoard: {
    // Board configuration (paused, moderation enabled, public posting allowed)
    boardConfig: { paused: false, moderation: true, publicPosting: false }
  },
  accessControl: {
    // Additional admins to add during initialization
    additionalAdmins: [] as string[],
    // Initial users to grant roles
    initialUsers: [] as string[]
  }
};

/**
 * Wait for transaction confirmation
 */
async function waitForConfirmation(txId: string, maxRetries: number = 30): Promise<void> {
  console.log(`⏳ Waiting for confirmation: ${txId}`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${NETWORK.coreApiUrl}/extended/v1/tx/${txId}`);
      const txData = await response.json();

      if (txData.tx_status === 'success') {
        console.log(`✅ Transaction confirmed: ${txId}`);
        return;
      } else if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
        throw new Error(`Transaction failed: ${txData.tx_status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Transaction confirmation timeout: ${txId}`);
      }
    }
  }
}

/**
 * Make a contract call
 */
async function makeCall(
  contractName: string,
  functionName: string,
  functionArgs: any[],
  description: string
): Promise<string> {
  console.log(`📞 ${description}...`);

  try {
    const contractCall = await makeContractCall({
      contractAddress: SENDER_ADDRESS,
      contractName,
      functionName,
      functionArgs,
      senderKey: PRIVATE_KEY,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 10000,
    });

    const result = await broadcastTransaction(contractCall, NETWORK);

    if (result.error) {
      throw new Error(`Call failed: ${result.error}`);
    }

    console.log(`✅ ${description} completed - TX: ${result.txid}`);
    return result.txid;

  } catch (error) {
    console.error(`❌ ${description} failed:`, error);
    throw error;
  }
}

/**
 * Initialize Access Control contract
 */
async function initializeAccessControl(): Promise<void> {
  console.log('\n--- Initializing Access Control Contract ---');

  const config = INITIALIZATION_CONFIG.accessControl;

  // Add additional admins
  for (const adminAddress of config.additionalAdmins) {
    const txId = await makeCall(
      'access-control',
      'add-admin',
      [principalCV(adminAddress)],
      `Adding admin: ${adminAddress}`
    );
    await waitForConfirmation(txId);
  }

  // Grant user roles to initial users
  for (const userAddress of config.initialUsers) {
    const txId = await makeCall(
      'access-control',
      'grant-user-role',
      [principalCV(userAddress)],
      `Granting user role to: ${userAddress}`
    );
    await waitForConfirmation(txId);
  }

  console.log('✅ Access Control initialization complete');
}

/**
 * Initialize Counter contract
 */
async function initializeCounter(): Promise<void> {
  console.log('\n--- Initializing Counter Contract ---');

  const config = INITIALIZATION_CONFIG.counter;

  // Set permission requirements
  const txId1 = await makeCall(
    'counter',
    'set-permission-requirements',
    [boolCV(config.permissionRequirements.increment), boolCV(config.permissionRequirements.decrement)],
    'Setting permission requirements'
  );
  await waitForConfirmation(txId1);

  // Set initial value if different from 0
  if (config.initialValue !== 0) {
    const txId2 = await makeCall(
      'counter',
      'set-counter',
      [uintCV(config.initialValue)],
      `Setting initial counter value to ${config.initialValue}`
    );
    await waitForConfirmation(txId2);
  }

  // Set pause state
  const txId3 = await makeCall(
    'counter',
    'set-contract-paused',
    [boolCV(config.initialPaused)],
    `Setting pause state to ${config.initialPaused}`
  );
  await waitForConfirmation(txId3);

  console.log('✅ Counter initialization complete');
}

/**
 * Initialize Voting System contract
 */
async function initializeVotingSystem(): Promise<void> {
  console.log('\n--- Initializing Voting System Contract ---');

  const config = INITIALIZATION_CONFIG.votingSystem;

  // Set voting duration limits
  const txId = await makeCall(
    'voting-system',
    'update-voting-duration',
    [uintCV(config.minVotingDuration), uintCV(config.maxVotingDuration)],
    `Setting voting duration limits (${config.minVotingDuration}-${config.maxVotingDuration} blocks)`
  );
  await waitForConfirmation(txId);

  console.log('✅ Voting System initialization complete');
}

/**
 * Initialize Message Board contract
 */
async function initializeMessageBoard(): Promise<void> {
  console.log('\n--- Initializing Message Board Contract ---');

  const config = INITIALIZATION_CONFIG.messageBoard;

  // Configure board settings
  const txId = await makeCall(
    'message-board',
    'configure-board',
    [
      boolCV(config.boardConfig.paused),
      boolCV(config.boardConfig.moderation),
      boolCV(config.boardConfig.publicPosting)
    ],
    'Configuring board settings'
  );
  await waitForConfirmation(txId);

  console.log('✅ Message Board initialization complete');
}

/**
 * Create sample data for demonstration (optional)
 */
async function createSampleData(): Promise<void> {
  console.log('\n--- Creating Sample Data ---');

  try {
    // Create a sample voting proposal
    const txId1 = await makeCall(
      'voting-system',
      'create-proposal',
      [
        stringAsciiCV('Welcome Proposal'),
        stringAsciiCV('Should we welcome new users to our platform?'),
        uintCV(1440) // 10 days
      ],
      'Creating welcome proposal'
    );
    await waitForConfirmation(txId1);

    // Post a welcome message
    const txId2 = await makeCall(
      'message-board',
      'post-message',
      [
        stringUtf8CV('Welcome to Essential Smart Contract Patterns! 🎉'),
        noneCV()
      ],
      'Posting welcome message'
    );
    await waitForConfirmation(txId2);

    // Pin the welcome message
    const txId3 = await makeCall(
      'message-board',
      'pin-message',
      [uintCV(1)],
      'Pinning welcome message'
    );
    await waitForConfirmation(txId3);

    console.log('✅ Sample data creation complete');

  } catch (error) {
    console.warn('⚠️  Sample data creation failed (this is optional):', error);
  }
}

/**
 * Load deployment info
 */
function loadDeploymentInfo(): any {
  const deploymentFile = path.join(
    __dirname,
    '..',
    'deployments',
    `${NETWORK_TYPE}-deployment.json`
  );

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  return JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
}

/**
 * Verify contracts are deployed
 */
async function verifyDeployment(): Promise<void> {
  console.log('🔍 Verifying contract deployment...');

  const deploymentInfo = loadDeploymentInfo();
  const contracts = ['access-control', 'counter', 'voting-system', 'message-board'];

  for (const contractName of contracts) {
    if (!deploymentInfo.contracts[contractName]) {
      throw new Error(`Contract ${contractName} not found in deployment info`);
    }

    const contractAddress = `${SENDER_ADDRESS}.${contractName}`;
    console.log(`   ✅ ${contractName}: ${contractAddress}`);
  }

  console.log('✅ All contracts verified');
}

/**
 * Main initialization function
 */
async function initializeAllContracts(): Promise<void> {
  console.log('🚀 Starting contract initialization...');
  console.log(`📍 Network: ${NETWORK_TYPE} (${NETWORK.coreApiUrl})`);
  console.log(`👤 Sender: ${SENDER_ADDRESS}`);

  try {
    // Verify deployment first
    await verifyDeployment();

    // Initialize contracts in dependency order
    await initializeAccessControl();
    await initializeCounter();
    await initializeVotingSystem();
    await initializeMessageBoard();

    // Optionally create sample data
    const createSamples = process.env.CREATE_SAMPLE_DATA === 'true';
    if (createSamples) {
      await createSampleData();
    }

    console.log('\n🎉 Contract initialization complete!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Test contract functionality');
    console.log('   2. Grant roles to additional users as needed');
    console.log('   3. Create proposals and messages');
    console.log('   4. Monitor contract activity');

    // Save initialization info
    const initInfo = {
      network: NETWORK_TYPE,
      timestamp: new Date().toISOString(),
      initializer: SENDER_ADDRESS,
      configuration: INITIALIZATION_CONFIG,
      sampleDataCreated: createSamples
    };

    const initFile = path.join(__dirname, '..', 'deployments', `${NETWORK_TYPE}-initialization.json`);
    fs.writeFileSync(initFile, JSON.stringify(initInfo, null, 2));
    console.log(`💾 Initialization info saved to: ${initFile}`);

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await initializeAllContracts();
  } catch (error) {
    console.error('💥 Initialization script failed:', error);
    process.exit(1);
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  main();
}

export { initializeAllContracts };