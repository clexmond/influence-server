const appConfig = require('config');
const RpcBackoff = require('@common/lib/RpcBackoff');
const web3 = require('@common/lib/web3');

class EthereumRpc {
  static get backoffOptions() {
    return {
      numOfAttempts: Number(appConfig.Ethereum?.rpcBackoff?.numOfAttempts || 6),
      startingDelay: Number(appConfig.Ethereum?.rpcBackoff?.startingDelay || 250)
    };
  }

  static callWithBackoff(fn, label) {
    return RpcBackoff.call(fn, {
      delayFirstAttempt: false,
      jitter: 'none',
      label: `EthereumRpc::${label}`,
      numOfAttempts: this.backoffOptions.numOfAttempts,
      startingDelay: this.backoffOptions.startingDelay
    });
  }

  static getBlock(blockNumber) {
    return this.callWithBackoff(() => web3.eth.getBlock(blockNumber), 'getBlock');
  }

  static getBlockNumber() {
    return this.callWithBackoff(() => web3.eth.getBlockNumber(), 'getBlockNumber');
  }

  static getPastLogs(filter) {
    return this.callWithBackoff(() => web3.eth.getPastLogs(filter), 'getPastLogs');
  }
}

module.exports = EthereumRpc;
