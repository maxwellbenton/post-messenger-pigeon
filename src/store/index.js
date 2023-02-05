"use strict";

class Store {
  constructor() {
    this._registry = {};
    this._prefix = "";
    this._completionSignal = "";
  }

  get prefix() {
    return this._prefix
  }

  set prefix(prefix) {
    this._prefix = prefix
  }

  get completionSignal() {
    return this._completionSignal
  }

  set completionSignal(completionSignal) {
    this._completionSignal = completionSignal
  }

  get registry() {
    return this._registry
  }

  register(messageName, callback) {
    this._registry[messageName] = callback;
  }

  unregister(messageName) {
    delete this._registry[messageName];
  }

  isRegistered(messageName) {
    return !!this._registry[messageName];
  }
}

module.exports = { Store: Store };