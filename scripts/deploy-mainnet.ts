#!/usr/bin/env node

/**
 * Essential Smart Contract Patterns - Mainnet Deployment Script
 *
 * ⚠️  CAUTION: This script deploys to MAINNET. Real STX tokens will be used.
 *
 * This script deploys all contracts to the Stacks mainnet with additional safety checks.
 * Make sure you have the required environment variables set:
 * - STACKS_PRIVATE_KEY: Your mainnet private key (be very careful with this!)
 * - STACKS_NETWORK: Should be 'mainnet'
 * - DEPLOY_CONFIRMATION: Must be set to 'YES_I_WANT_TO_DEPLOY_TO_MAINNET'
 */

import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  StacksMainnet
} from '@stacks/transactions';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Configuration
const NETWORK = new StacksMainnet();
const PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY || '';
const SENDER_ADDRESS = process.env.STACKS_ADDRESS || '';
const DEPLOY_CONFIRMATION = process.env.DEPLOY_CONFIRMATION || '';

// Safety checks
const REQUIRED_CONFIRMATION = 'YES_I_WANT_TO_DEPLOY_TO_MAINNET';

if (!PRIVATE_KEY) {
  console.error('❌ STACKS_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

if (!SENDER_ADDRESS) {
  console.error('❌ STACKS_ADDRESS environment variable is required');
  process.exit(1);
}

if (DEPLOY_CONFIRMATION !== REQUIRED_CONFIRMATION) {
  console.error('❌ Safety check failed. Set DEPLOY_CONFIRMATION environment variable to:');
  console.error(`   ${REQUIRED_CONFIRMATION}`);
  process.exit(1);
}

// Contract deployment order (respecting dependencies)
const DEPLOYMENT_ORDER = [
  'access-control',
  'counter',
  'voting-system',
  'message-board'
];

// Mainnet deployment fees (higher than testnet)
const DEPLOYMENT_FEES = {
  'access-control': 50000,  // 0.05 STX
  'counter': 40000,         // 0.04 STX
  'voting-system': 60000,   // 0.06 STX
  'message-board': 70000    // 0.07 STX
};

/**
 * Read contract source code
 */
function readContractSource(contractName: string): string {
  const filePath = path.join(__dirname, '..', 'contracts', `${contractName}.clar`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Contract file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Get user confirmation for mainnet deployment
 */
async function getUserConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('');
    console.log('⚠️  MAINNET DEPLOYMENT WARNING ⚠️');
    console.log('='.repeat(50));
    console.log('You are about to deploy contracts to MAINNET.');
    console.log('This will use real STX tokens for transaction fees.');
    console.log('');
    console.log(`Network: ${NETWORK.coreApiUrl}`);
    console.log(`Deployer: ${SENDER_ADDRESS}`);
    console.log('');
    console.log('Estimated total fees:');
    const totalFees = Object.values(DEPLOYMENT_FEES).reduce((sum, fee) => sum + fee, 0);
    console.log(`  ${totalFees / 1000000} STX (${totalFees} microSTX)`);
    console.log('');
    console.log('Contracts to deploy:');
    DEPLOYMENT_ORDER.forEach((contract, index) => {
      console.log(`  ${index + 1}. ${contract}`);
    });
    console.log('');

    rl.question('Are you sure you want to proceed? (type "YES" to confirm): ', (answer) => {
      rl.close();
      resolve(answer === 'YES');
    });
  });
}

/**
 * Check account balance
 */
async function checkAccountBalance(): Promise<void> {
  console.log('💰 Checking account balance...');

  try {
    const response = await fetch(
      `${NETWORK.coreApiUrl}/extended/v1/address/${SENDER_ADDRESS}/balances`
    );
    const balanceData = await response.json();

    const stxBalance = parseInt(balanceData.stx.balance);
    const totalFees = Object.values(DEPLOYMENT_FEES).reduce((sum, fee) => sum + fee, 0);

    console.log(`   STX Balance: ${stxBalance / 1000000} STX`);
    console.log(`   Required Fees: ${totalFees / 1000000} STX`);

    if (stxBalance < totalFees * 2) { // 2x buffer for safety
      console.log('⚠️  Warning: Low STX balance. Consider adding more STX to your account.');
      console.log('   Recommended balance: at least 2x the required fees for safety.');
    } else {
      console.log('✅ Sufficient balance detected.');
    }

  } catch (error) {
    console.warn('⚠️  Could not check balance. Proceeding anyway...');
  }
}

/**
 * Deploy a single contract with enhanced error handling
 */
async function deployContract(contractName: string, contractSource: string): Promise<string> {
  console.log(`📦 Deploying ${contractName} to mainnet...`);

  try {
    const fee = DEPLOYMENT_FEES[contractName as keyof typeof DEPLOYMENT_FEES] || 50000;

    const deployTx = await makeContractDeploy({
      contractName,
      codeBody: contractSource,
      senderKey: PRIVATE_KEY,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee,
    });

    const result = await broadcastTransaction(deployTx, NETWORK);

    if (result.error) {
      throw new Error(`Deployment failed: ${result.error}`);
    }

    console.log(`✅ ${contractName} deployed successfully`);
    console.log(`   Transaction ID: ${result.txid}`);
    console.log(`   Contract Address: ${SENDER_ADDRESS}.${contractName}`);
    console.log(`   Fee: ${fee / 1000000} STX`);

    return result.txid;

  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error);
    throw error;
  }
}

/**
 * Wait for transaction confirmation with longer timeout for mainnet
 */
async function waitForConfirmation(txId: string, maxRetries: number = 60): Promise<void> {
  console.log(`⏳ Waiting for mainnet confirmation: ${txId}`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${NETWORK.coreApiUrl}/extended/v1/tx/${txId}`);
      const txData = await response.json();

      console.log(`   Status: ${txData.tx_status} (${i + 1}/${maxRetries})`);

      if (txData.tx_status === 'success') {
        console.log(`✅ Transaction confirmed: ${txId}`);
        return;
      } else if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
        throw new Error(`Transaction failed: ${txData.tx_status} - ${txData.tx_result?.repr || 'Unknown error'}`);
      }

      // Wait 20 seconds before next check (mainnet is slower)
      await new Promise(resolve => setTimeout(resolve, 20000));

    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Transaction confirmation timeout: ${txId}`);
      }
      console.log(`   Retry ${i + 1}/${maxRetries}...`);
    }
  }
}

/**
 * Deploy all contracts in order with enhanced safety
 */
async function deployAllContracts(): Promise<void> {
  console.log('🚀 Starting Essential Smart Contract Patterns deployment to MAINNET...');
  console.log(`📍 Network: ${NETWORK.coreApiUrl}`);
  console.log(`👤 Deployer: ${SENDER_ADDRESS}`);

  // Safety checks
  await checkAccountBalance();

  const userConfirmed = await getUserConfirmation();
  if (!userConfirmed) {
    console.log('❌ Deployment cancelled by user.');
    process.exit(0);
  }

  console.log('');
  console.log('🎯 Starting deployment...');

  const deploymentResults: { [key: string]: string } = {};
  const startTime = Date.now();

  try {
    for (const contractName of DEPLOYMENT_ORDER) {
      console.log('');
      console.log(`--- Deploying ${contractName} ---`);

      const contractSource = readContractSource(contractName);
      const txId = await deployContract(contractName, contractSource);

      // Wait for confirmation before deploying next contract
      await waitForConfirmation(txId);

      deploymentResults[contractName] = txId;

      // Longer delay between mainnet deployments
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const endTime = Date.now();
    const deploymentTime = Math.round((endTime - startTime) / 1000);

    console.log('');
    console.log('🎉 ALL CONTRACTS DEPLOYED TO MAINNET SUCCESSFULLY!');
    console.log('');
    console.log('📋 Deployment Summary:');
    console.log('='.repeat(80));

    let totalFeesUsed = 0;
    for (const [contractName, txId] of Object.entries(deploymentResults)) {
      const fee = DEPLOYMENT_FEES[contractName as keyof typeof DEPLOYMENT_FEES] || 50000;
      totalFeesUsed += fee;

      console.log(`${contractName.padEnd(20)} | ${SENDER_ADDRESS}.${contractName}`);
      console.log(`${''.padEnd(20)} | TX: ${txId}`);
      console.log(`${''.padEnd(20)} | Fee: ${fee / 1000000} STX`);
      console.log('-'.repeat(80));
    }

    console.log(`${'Total Time:'.padEnd(20)} | ${deploymentTime} seconds`);
    console.log(`${'Total Fees:'.padEnd(20)} | ${totalFeesUsed / 1000000} STX`);
    console.log('='.repeat(80));

    console.log('');
    console.log('🔗 Mainnet Explorer URLs:');
    for (const [contractName, txId] of Object.entries(deploymentResults)) {
      const explorerUrl = `https://explorer.stacks.co/txid/${txId}?chain=mainnet`;
      console.log(`${contractName}: ${explorerUrl}`);
    }

    // Save deployment info
    const deploymentInfo = {
      network: 'mainnet',
      deployer: SENDER_ADDRESS,
      timestamp: new Date().toISOString(),
      deploymentTimeSeconds: deploymentTime,
      totalFeesSTX: totalFeesUsed / 1000000,
      contracts: Object.fromEntries(
        Object.entries(deploymentResults).map(([name, txId]) => [
          name,
          {
            address: `${SENDER_ADDRESS}.${name}`,
            transactionId: txId,
            fee: DEPLOYMENT_FEES[name as keyof typeof DEPLOYMENT_FEES] / 1000000
          }
        ])
      )
    };

    const deploymentFile = path.join(__dirname, '..', 'deployments', 'mainnet-deployment.json');
    fs.mkdirSync(path.dirname(deploymentFile), { recursive: true });
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log(`💾 Deployment info saved to: ${deploymentFile}`);
    console.log('');
    console.log('🎊 MAINNET DEPLOYMENT COMPLETE!');

  } catch (error) {
    console.error('❌ MAINNET DEPLOYMENT FAILED:', error);
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('   1. Check your STX balance');
    console.log('   2. Verify network connectivity');
    console.log('   3. Check if contract names are already taken');
    console.log('   4. Review error messages above');
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await deployAllContracts();
  } catch (error) {
    console.error('💥 Mainnet deployment script failed:', error);
    process.exit(1);
  }
}

// Run the deployment if this script is executed directly
if (require.main === module) {
  main();
}

export { deployAllContracts, deployContract };