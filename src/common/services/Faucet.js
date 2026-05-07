const mongoose = require('mongoose');
const appConfig = require('config');
const { Address } = require('@influenceth/sdk');
const logger = require('@common/lib/logger');
const starknetClient = require('@common/lib/starknet/client');

const erc20Abi = require('@common/lib/starknet/abis/erc20.json');
const { ValidationError } = require('../lib/errors');

class FaucetService {
  // Retrieves data on last claimed and total claimed for a user, for both ETH and SWAY tokens
  static async getFaucetInfo({ recipient }) {
    const docs = await mongoose.model('Faucet').find({ recipient: Address.toStandard(recipient) });
    const info = {
      ETH: { lastClaimed: null, totalClaimed: 0 },
      SWAY: { lastClaimed: null, totalClaimed: 0 }
    };

    for (const doc of docs) {
      info[doc.token] = {
        lastClaimed: doc.lastClaimed,
        totalClaimed: doc.totalClaimed
      };
    }

    return info;
  }

  // Records a claim for a user and sends the token on-chain, returns the tx hash
  static async recordClaim({ recipient, token }) {
    const tokens = {
      ETH: {
        amount: 15000000000000000n, // 0.015 ETH
        decimals: 1e18,
        contract: appConfig.get('Contracts.starknet.ether')
      },
      SWAY: {
        amount: 400000000000n, // 400,000 SWAY
        decimals: 1e6,
        contract: appConfig.get('Contracts.starknet.sway')
      }
    };

    // Make sure the token is supported
    if (!Object.keys(tokens).includes(token)) {
      throw new ValidationError('Unsupported token');
    }

    const model = mongoose.model('Faucet');
    let doc = await model.findOne({ recipient: Address.toStandard(recipient), token });

    // If no record exists, create one
    if (!doc) {
      doc = model({
        recipient: Address.toStandard(recipient),
        token,
        lastClaimed: null,
        totalClaimed: 0
      });
    }

    // Ensure the last claimed date was at least 23.5 hours ago
    if (doc.lastClaimed && new Date() - doc.lastClaimed < 23.5 * 60 * 60 * 1000) {
      throw new ValidationError('Last claim is too recent');
    }

    // Execute the transfer on-chain
    const provider = await starknetClient.createRpcProvider({ nodeUrl: appConfig.get('Starknet.rpcProvider') });
    const account = starknetClient.createAccount({
      provider,
      address: appConfig.get('Contracts.starknet.faucet'),
      signer: appConfig.get('Starknet.faucetPrivateKey')
    });

    const erc20 = starknetClient.createContract({
      abi: erc20Abi,
      address: tokens[token].contract,
      providerOrAccount: account
    });
    let txHash;

    try {
      const response = await erc20.transfer(
        recipient,
        starknetClient.starknet.uint256.bnToUint256(tokens[token].amount)
      );
      txHash = response.transaction_hash;
    } catch (e) {
      logger.warn(e.message || e);
      throw new ValidationError('Failed to send tokens');
    }

    doc.lastClaimed = new Date();
    doc.totalClaimed += Number(tokens[token].amount) / tokens[token].decimals;

    await doc.save();
    return txHash;
  }
}

module.exports = FaucetService;
