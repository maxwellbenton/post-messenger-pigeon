(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
class Store {
  constructor() {
    this._registry = {};
    this._prefix = "";
  }

  get prefix() {
    return this._prefix
  }

  set prefix(prefix) {
    this._prefix = prefix
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

class Messenger {
  constructor() {
    this._store = new Store();
    window.addEventListener('message', async (event) => {
      console.log('MESSAGE RECEIVED', event)
      const { data, origin, source } = event;
      const parsedData = JSON.parse(data);
      if (this.isRegistered(parsedData.messageName)) {
        let result
        try {
          result = await this.store.registry[parsedData.messageName]({ origin, source, data: parsedData })
          console.log('END OF MESSAGE LISTENER CALLBACK', result)
        } catch (e) {
          console.log('Error in callback', e)
        }
      }
    })
  }

  createMessage(messageName, data, origin) {
    const message = JSON.stringify({
      messageName,
      ...(data && Object.keys(data).length && { data }),
      ...(origin && { origin })
    })
    console.log('CREATED MESSAGE', message)
    return message
  }

  register(messageName, callback) {
    this._store.register(messageName, callback);
  }

  unregister(messageName) {
    this._store.unregister(messageName);
  }

  isRegistered(messageName) {
    return this._store.isRegistered(messageName);
  }

  get registry() {
    this._store.registry;
  }

  messagePrefix() {
    return this._store.prefix
  }

  get store() {
    return this._store
  }

  setMessagePrefix(prefix) {
    this._store.prefix = prefix
  }

  async _listen(messageName, callback, config, once = true) {
    const actualMessageName = this.store.prefix + '.' + messageName
    console.log('LISTENING', actualMessageName, callback)
    let cancel, result
    const actualPromise = new Promise((resolve, reject) => {
      const wrappedCallback = async (e) => {
        if (once) this.unregister(messageName);

        // data is already parsed here
        const { data, origin, source } = e;
        if (config?.domain && config.domain !== origin) return
        console.log('CALLBACK', callback)
        result = await callback(data);
        console.log('CALLBACK RESULT', result)

        if (!data.messageName.endsWith('.acknowledged')) {
          const message = this.createMessage(data.messageName + '.acknowledged', result)
          this._broadcast(source, message, origin)
        }

        if (once) resolve(result)
      }
      this.register(actualMessageName, wrappedCallback);
    })

    
    const cancelPromise = new Promise((resolve, reject) => {
      cancel = () => {
        this.unregister(actualMessageName);
        resolve()
      }
    })

    return Object.assign(
      Promise.race([actualPromise, cancelPromise]), 
      { cancel }
    )
  }

  bootstrap(prefix) {
    this.setMessagePrefix(prefix)
    this._listen('handshake', (data) => {
      console.log('INSIDE HANDSHAKE CALLBACK', data)
      const messageName = data?.data?.messageName
      return {
        messageName,
        registered: this.isRegistered(messageName)
      }
    }, {}, false)
  }
    
  _broadcast(targetWindow, message, targetOrigin) {
    console.log('BROADCASTING', message, targetOrigin)
    targetWindow.postMessage(message, targetOrigin);
  }

  on(messageName, config = {}, callback = (e) => e) {
    if (!messageName) {
      throw new Error('Message name is required');
    }
    return this._listen(messageName, callback, config, false)
  }

  async once(messageName, config = {}, callback = (e) => e) {
    if (!messageName) {
      throw new Error('Message name is required');
    }
    return this._listen(messageName, callback, config, true)
  }

  async send(messageName, config, data) {
    if (!messageName) {
      throw new Error('Message name is required');
    }
    const prefix = this.store.prefix
    const actualMessageName = prefix + '.' + messageName
    console.log('STARTING SEND', actualMessageName, config, data)
    let sendPromise = new Promise((resolve, reject) => {
      if (config?.timeout) {
        setTimeout(() => reject(new Error('Timeout')), config.timeout)
      }

      this._listen('handshake.acknowledged', (e) => e, { window: window.parent }, true)
        .then(result => {
          console.log('HANDSHAKE ACKNOWLEDGED', result)
          if (result?.data?.registered) {
            
            this._listen(messageName + '.acknowledged', (e) => e, config, true)
              .then(result => {
                console.log('MESSAGE ACKNOWLEDGED', result)
                resolve(result)
              })

            const message = this.createMessage(actualMessageName, data)
            console.log('SENDING MESSAGE', message)
            this._broadcast(config.window, message, config.origin)
          } else {
            throw new Error(`No listener registered for ${actualMessageName}`)
          }
        })

        const handshakeMessage = this.createMessage(prefix + '.' + 'handshake', { messageName: actualMessageName })
        console.log('SENDING HANDSHAKE', handshakeMessage)
        this._broadcast(config.window, handshakeMessage, config.origin)
        
    })

    return await sendPromise
  }
}

const messenger = new Messenger();
const PostMessengerPigeon = {
  bootstrap: messenger.bootstrap,
  on: messenger.on,
  once: messenger.once,
  send: messenger.send,
}

window.PostMessengerPigeon = PostMessengerPigeon
module.exports = PostMessengerPigeon
},{}]},{},[1]);
