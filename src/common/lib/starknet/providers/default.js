const { defaults } = require('lodash');
const RpcBackoff = require('@common/lib/RpcBackoff');

class DefaultStarknetProvider {
  get defaultBackoffOptions() {
    return { numOfAttempts: 10, startingDelay: 20 };
  }

  constructor({ backoffOpts, ...props } = {}) {
    this.endpoint = props.endpoint;
    this._backoffOptions = defaults(
      {},
      backoffOpts,
      this.defaultBackoffOptions
    );
  }

  _callWithBackoff(fn, fnName) {
    return RpcBackoff.call(fn, {
      delayFirstAttempt: true,
      label: fnName,
      numOfAttempts: this._backoffOptions.numOfAttempts,
      startingDelay: this._backoffOptions.startingDelay
    });
  }
}

module.exports = DefaultStarknetProvider;
