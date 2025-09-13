#!/usr/bin/env node

/**
 * Essential Smart Contract Patterns - Testnet Deployment Script
 *
 * This script deploys all contracts to the Stacks testnet.
 * Make sure you have the required environment variables set:
 * - STACKS_PRIVATE_KEY: Your testnet private key
 * - STACKS_NETWORK: Should be 'testnet'
 */

import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  StacksTestnet,
  StacksMainnet
} from '@stacks/transactions';
import { StacksNetwork } from '@stacks/network';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const NETWORK = new StacksTestnet();
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

// Contract deployment order (respecting dependencies)
const DEPLOYMENT_ORDER = [
  'access-control',
  'counter',
  'voting-system',
  'message-board'
];

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
 * Deploy a single contract
 */
async function deployContract(contractName: string, contractSource: string): Promise<string> {
  console.log(`📦 Deploying ${contractName}...`);

  try {
    const deployTx = await makeContractDeploy({
      contractName,
      codeBody: contractSource,
      senderKey: PRIVATE_KEY,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 10000, // 0.01 STX
    });

    const result = await broadcastTransaction(deployTx, NETWORK);

    if (result.error) {
      throw new Error(`Deployment failed: ${result.error}`);
    }

    console.log(`✅ ${contractName} deployed successfully`);
    console.log(`   Transaction ID: ${result.txid}`);
    console.log(`   Contract Address: ${SENDER_ADDRESS}.${contractName}`);

    return result.txid;

  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error);
    throw error;
  }
}

/**
 * Wait for transaction confirmation
 */
async function waitForConfirmation(txId: string, maxRetries: number = 30): Promise<void> {
  console.log(`⏳ Waiting for transaction confirmation: ${txId}`);

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

      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Transaction confirmation timeout: ${txId}`);
      }
    }
  }
}

/**
 * Deploy all contracts in order
 */
async function deployAllContracts(): Promise<void> {
  console.log('🚀 Starting Essential Smart Contract Patterns deployment to testnet...');
  console.log(`📍 Network: ${NETWORK.coreApiUrl}`);
  console.log(`👤 Deployer: ${SENDER_ADDRESS}`);
  console.log('');

  const deploymentResults: { [key: string]: string } = {};

  try {
    for (const contractName of DEPLOYMENT_ORDER) {
      console.log(`--- Deploying ${contractName} ---`);

      const contractSource = readContractSource(contractName);
      const txId = await deployContract(contractName, contractSource);

      // Wait for confirmation before deploying next contract
      await waitForConfirmation(txId);

      deploymentResults[contractName] = txId;
      console.log('');

      // Small delay between deployments
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('🎉 All contracts deployed successfully!');
    console.log('');
    console.log('📋 Deployment Summary:');
    console.log('='.repeat(50));

    for (const [contractName, txId] of Object.entries(deploymentResults)) {
      console.log(`${contractName.padEnd(20)} | ${SENDER_ADDRESS}.${contractName}`);
      console.log(`${''.padEnd(20)} | TX: ${txId}`);
      console.log('-'.repeat(50));
    }

    console.log('');
    console.log('🔗 Contract URLs:');
    for (const contractName of Object.keys(deploymentResults)) {
      const explorerUrl = `https://explorer.stacks.co/txid/${deploymentResults[contractName]}?chain=testnet`;
      console.log(`${contractName}: ${explorerUrl}`);
    }

    // Save deployment info to file
    const deploymentInfo = {
      network: 'testnet',
      deployer: SENDER_ADDRESS,
      timestamp: new Date().toISOString(),
      contracts: Object.fromEntries(
        Object.entries(deploymentResults).map(([name, txId]) => [
          name,
          {
            address: `${SENDER_ADDRESS}.${name}`,
            transactionId: txId
          }
        ])
      )
    };

    const deploymentFile = path.join(__dirname, '..', 'deployments', 'testnet-deployment.json');
    fs.mkdirSync(path.dirname(deploymentFile), { recursive: true });
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log(`💾 Deployment info saved to: ${deploymentFile}`);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
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
    console.error('💥 Deployment script failed:', error);
    process.exit(1);
  }
}

// Run the deployment if this script is executed directly
if (require.main === module) {
  main();
}

export { deployAllContracts, deployContract };