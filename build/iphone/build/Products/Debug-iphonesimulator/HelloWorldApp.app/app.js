(function () {
  'use strict';

  /*
   * Event Emitters
   */

  /**
   * Initialize a new `Emitter`.
   *
   * @param {Object} obj Object to be mixed in to emitter
   * @returns {Emitter}
   * @public
   */
  function Emitter(obj) {
    if (obj) {
      return mixin(obj);
    }
  }

  /**
   * Mixin the emitter properties.
   *
   * @param {Object} obj object to be mixed in
   * @return {Object} object with Emitter properties mixed in
   * @private
   */
  function mixin(obj) {
    for (const key in Emitter.prototype) {
      obj[key] = Emitter.prototype[key];
    }
    return obj;
  }

  /**
   * Listen on the given `event` with `fn`.
   *
   * @param {string} event event name to hook callback to
   * @param {Function} fn callback function
   * @return {Emitter} this
   * @public
   */
  Emitter.prototype.on = function (event, fn) {
    this._callbacks = this._callbacks || {};
    (this._callbacks[event] = this._callbacks[event] || []).
    push(fn);
    return this;
  };

  /**
   * Adds an `event` listener that will be invoked a single
   * time then automatically removed.
   *
   * @param {string} event event name to hook callback to
   * @param {Function} fn callback function
   * @return {Emitter} this
   * @public
   */
  Emitter.prototype.once = function (event, fn) {
    const self = this;
    this._callbacks = this._callbacks || {};

    /**
     * single-fire callback for event
     */
    function on() {
      self.off(event, on);
      fn.apply(this, arguments);
    }

    fn._off = on;
    this.on(event, on);
    return this;
  };

  /**
   * Remove the given callback for `event` or all
   * registered callbacks.
   *
   * @param {string} event event name to remove callback from
   * @param {Function} fn callback function
   * @return {Emitter} this
   * @public
   */
  Emitter.prototype.off = function (event, fn) {
    this._callbacks = this._callbacks || {};
    let callbacks = this._callbacks[event];
    if (!callbacks) {
      return this;
    }

    // remove all handlers
    if (arguments.length === 1) {
      delete this._callbacks[event];
      return this;
    }

    // remove specific handler
    const i = callbacks.indexOf(fn._off || fn);
    if (~i) {
      callbacks.splice(i, 1);
    }
    return this;
  };

  /**
   * Emit `event` with the given args.
   *
   * @param {string} event event name
   * @return {Emitter}
   * @public
   */
  Emitter.prototype.emit = function (event) {
    this._callbacks = this._callbacks || {};
    const args = [].slice.call(arguments, 1);
    let callbacks = this._callbacks[event];

    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (let i = 0, len = callbacks.length; i < len; ++i) {
        callbacks[i].apply(this, args);
      }
    }

    return this;
  };

  /**
   * Return array of callbacks for `event`.
   *
   * @param {string} event event name
   * @return {Array} array of callbacks registered for that event
   * @public
   */
  Emitter.prototype.listeners = function (event) {
    this._callbacks = this._callbacks || {};
    return this._callbacks[event] || [];
  };

  /**
   * Check if this emitter has `event` handlers.
   *
   * @param {string} event event name
   * @return {boolean}
   * @public
   */
  Emitter.prototype.hasListeners = function (event) {
    return !!this.listeners(event).length;
  };

  /**
   * Initialize a new `Process`.
   * @returns {Process}
   * @public
   */
  function Process() {
    if (!(this instanceof Process)) {
      return new Process();
    }
    this.title = 'titanium';
    this.version = '';
    this.moduleLoadList = [];
    this.versions = {};
    this.arch = Ti.Platform.architecture;
    this.platform = "iphone";
    this.hardware = ('' + Ti.Platform.model).replace('google_');
  }

  // inherit from EventEmitter
  Object.setPrototypeOf(Process.prototype, Emitter.prototype);

  /**
   * [Socket description]
   * @param {Object} opts [description]
   * @returns {Socket}
   */
  function Socket(opts) {
    if (!(this instanceof Socket)) {
      return new Socket(opts);
    }
    opts = opts || {};
    this.timeout = 5000;
    this.host = opts.host;
    this.port = opts.port;
    this.retry = opts.retry;
    this.bytesRead = 0;
    this.bytesWritten = 0;
    this.ignore = [];
  }

  /**
   * Inherit from `Emitter.prototype`.
   */
  Object.setPrototypeOf(Socket.prototype, Emitter.prototype);

  /**
   * [connect description]
   * @param  {Object}   opts [description]
   * @param  {Function} fn   [description]
   */
  Socket.prototype.connect = function (opts, fn) {
    opts = opts || {};
    if (typeof opts === 'function') {
      fn = opts;
      opts = {};
    }

    const self = this;
    self.host = opts.host || self.host || '127.0.0.1';
    self.port = opts.port || self.port;
    self.retry = opts.retry || self.retry;

    const reConnect = !!opts.reConnect;
    this._proxy = Ti.Network.Socket.createTCP({
      host: self.host,
      port: self.port,
      /**
       * [description]
       * @param  {Object} e [description]
       */
      connected: function (e) {
        self.connected = true;
        self._connection = e.socket;
        fn && fn(e);
        self.emit(reConnect ? 'reconnect' : 'connect', e);

        Ti.Stream.pump(e.socket, function (e) {
          if (e.bytesProcessed < 0 || !!e.errorStatus) {
            self._proxy.close();
            self.close(true);
            return;
          } else {
            self.emit('data', '' + e.buffer);
          }
        }, 1024, true);
      },
      /**
       * [description]
       * @param  {Object} e [description]
       * @returns {undefined}
       */
      error: function (e) {
        if (!~self.ignore.indexOf(e.code)) {
          return self.emit('error', e);
        }
        self.emit('error ignored', e);
      }
    });

    this._proxy.connect();
  };

  /**
   * [close description]
   * @param {boolean} serverEnded [description]
   */
  Socket.prototype.close = function (serverEnded) {
    const self = this;

    self.connected = false;
    self.closing = !serverEnded;

    if (self.closing) {
      self.write(function () {
        self._proxy.close();
        self.emit('close');
      });
      return;
    }

    const retry = ~~self.retry;

    self.emit('end');
    if (!retry) {
      return;
    }

    setTimeout(function () {
      self.emit('reconnecting');
      self.connect({ reConnect: true });
    }, retry);
  };

  /**
   * [description]
   * @param  {string}   data [description]
   * @param  {Function} fn   [description]
   */
  Socket.prototype.write = function (data, fn) {
    if (typeof data === 'function') {
      fn = data;
      data = null;
    }

    data = data ? '' + data : '';

    const msg = Ti.createBuffer({ value: data });

    const callback = fn || function () {};

    Ti.Stream.write(this._connection, msg, function () {
      callback([].slice(arguments));
    });

  };

  /**
   * [setKeepAlive description]
   * @param {boolean} enable       [description]
   * @param {number} initialDelay [description]
   */
  Socket.prototype.setKeepAlive = function (enable, initialDelay) {
    const self = this;
    if (!enable) {
      self._keepAlive && clearInterval(self._keepAlive);
      self._keepAlive = null;
      return;
    }
    self._keepAlive = setInterval(function () {
      self.write('ping');
    }, initialDelay || 300000);
  };

  /**
   * Initialize a new `Module`.
   * @param {string} id The module identifier
   * @public
   */
  function Module(id) {
    this.filename = id + '.js';
    this.id = id;
    if (process.platform === 'ipad') {
      this.platform = 'iphone';
    } else if (process.platform === 'windowsphone' || process.platform === 'windowsstore') {
      this.platform = 'windows';
    } else {
      this.platform = process.platform;
    }
    this.exports = {};
    this.loaded = false;
  }

  function L(name, filler) {
    return (Module._globalCtx.localeStrings[Ti.Locale.currentLanguage] || {})[name] || filler || name;
  }

  // global namespace
  const global$1 = Module._global = Module.global = {};

  // main process
  const process = global$1.process = new Process();
  process.on('uncaughtException', function (err) {
    console.log('[LiveView] Error Evaluating', err.module, '@ Line:', err.error.line);
    // console.error('Line ' + err.error.line, ':', err.source[err.error.line]);
    console.error('' + err.error);
    console.error('File:', err.module);
    console.error('Line:', err.error.line);
    console.error('SourceId:', err.error.sourceId);
    console.error('Backtrace:\n', ('' + err.error.backtrace).replace(/'\n'/g, '\n'));
  });

  // set environment type
  global$1.ENV = 'liveview';

  // set logging
  global$1.logging = false;

  // catch uncaught errors
  global$1.CATCH_ERRORS = true;

  // module cache
  Module._cache = {};

  /**
   * place holder for native require until patched
   *
   * @private
   */
  Module._requireNative = function () {
    throw new Error('Module.patch must be run first');
  };

  /**
   * place holder for native require until patched
   *
   * @private
   */
  Module._includeNative = function () {
    throw new Error('Module.patch must be run first');
  };

  /**
   * replace built in `require` function
   *
   * @param  {Object} globalCtx Global context
   * @param  {string} url The URL to use (default is '127.0.0.1', or '10.0.2.2' on android emulator)
   * @param  {number} port The port to use (default is 8324)
   * @private
   */
  Module.patch = function (globalCtx, url, port) {
    const defaultURL = process.platform === 'android' && process.hardware === 'sdk' ?
    '10.0.2.2' :
    Ti.Platform.model === 'Simulator' ? '127.0.0.1' : '10.132.23.22';
    Module._globalCtx = globalCtx;
    global$1._globalCtx = globalCtx;
    Module._url = url || defaultURL;
    Module._port = parseInt(port, 10) || 8324;
    Module._requireNative = require;
    Module.evtServer && Module.evtServer.close();
    Module._compileList = [];

    // FIX for android bug
    try {
      Ti.App.Properties.setBool('ti.android.bug2373.finishfalseroot', false);
    } catch (e) {

      // ignore
    }
    globalCtx.localeStrings = Module.require('localeStrings');
    Module.connectServer();
  };

  /**
   * [reload description]
   */
  Module.global.reload = function () {
    try {
      Module.evtServer._proxy.close();
      console.log('[LiveView] Reloading App');
      Ti.App._restart();
    } catch (e) {
      console.log('[LiveView] Reloading App via Legacy Method');
      Module.require('app');
    }
  };

  /**
   * [description]
   */
  Module.connectServer = function () {
    let retryInterval = null;
    const client = Module.evtServer = new Socket({ host: Module._url, port: parseInt('8323', 10) }, function () {
      console.log('[LiveView]', 'Connected to Event Server');
    });

    client.on('close', function () {
      console.log('[LiveView]', 'Closed Previous Event Server client');
    });

    client.on('connect', function () {
      if (retryInterval !== null) {
        clearInterval(retryInterval);
        console.log('[LiveView]', 'Reconnected to Event Server');
      }
    });

    client.on('data', function (data) {
      if (!data) {
        return;
      }
      try {
        const evt = JSON.parse('' + data);
        if (evt.type === 'event' && evt.name === 'reload') {
          Module._cache = {};
          Module.global.reload();
        }
      } catch (e) {/* discard non JSON data for now */}
    });

    client.on('end', function () {
      console.error('[LiveView]', 'Disconnected from Event Server');
      retryInterval = setInterval(function () {
        console.log('[LiveView]', 'Attempting reconnect to Event Server');
        client.connect();
      }, 2000);
    });

    client.on('error', function (e) {
      let err = e.error;
      const code = ~~e.code;
      if (retryInterval !== null && code === 61) {
        return;
      }

      if (code === 61) {
        err = 'Event Server unavailable. Connection Refused @ ' +
        Module._url + ':' + Module._port +
        '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.';
      }
      throw new Error('[LiveView] ' + err);
    });

    client.connect();
    Module.require('app');
  };

  /**
   * include script loader
   * @param  {string} ctx context
   * @param  {string} id module identifier
   * @public
   */
  Module.include = function (ctx, id) {
    const file = id.replace('.js', ''),
      src = Module.prototype._getRemoteSource(file, 10000);
    eval.call(ctx, src); // eslint-disable-line no-eval
  };

  /**
   * convert relative to absolute path
   * @param  {string} parent parent file path
   * @param  {string} relative relative path in require
   * @return {string} absolute path of the required file
   * @public
   */
  Module.toAbsolute = function (parent, relative) {
    let newPath = parent.split('/'),
      parts = relative.split('/');

    newPath.pop();

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '.') {
        continue;
      }

      if (parts[i] === '..') {
        newPath.pop();
      } else {
        newPath.push(parts[i]);
      }
    }
    return newPath.join('/');
  };

  /**
   * commonjs module loader
   * @param  {string} id module identifier
   * @returns {Object}
   * @public
   */
  Module.require = function (id) {
    let fullPath = id;

    if (fullPath.indexOf('./') === 0 || fullPath.indexOf('../') === 0) {
      const parent = Module._compileList[Module._compileList.length - 1];
      fullPath = Module.toAbsolute(parent, fullPath);
    }

    const cached = Module.getCached(fullPath) || Module.getCached(fullPath.replace('/index', '')) || Module.getCached(fullPath + '/index');

    if (cached) {
      return cached.exports;
    }

    if (!Module.exists(fullPath)) {
      if (fullPath.indexOf('/') === 0 && Module.exists(fullPath + '/index')) {
        fullPath += '/index';
      } else {
        const hlDir = '/hyperloop/';
        if (fullPath.indexOf('.*') !== -1) {
          fullPath = id.slice(0, id.length - 2);
        }

        const modLowerCase = fullPath.toLowerCase();
        if (Module.exists(hlDir + fullPath)) {
          fullPath = hlDir + fullPath;
        } else if (Module.exists(hlDir + modLowerCase)) {
          fullPath = hlDir + modLowerCase;
        } else if (fullPath.indexOf('.') === -1 && Module.exists(hlDir + fullPath + '/' + fullPath)) {
          fullPath = hlDir + fullPath + '/' + fullPath;
        } else if (fullPath.indexOf('.') === -1 && Module.exists(hlDir + modLowerCase + '/' + modLowerCase)) {
          fullPath = hlDir + modLowerCase + '/' + modLowerCase;
        } else {
          const lastIndex = fullPath.lastIndexOf('.');
          const tempPath = hlDir + fullPath.slice(0, lastIndex) + '$' + fullPath.slice(lastIndex + 1);
          if (Module.exists(fullPath)) {
            fullPath = tempPath;
          }
        }
      }
    }

    const freshModule = new Module(fullPath);

    freshModule.cache();
    freshModule._compile();

    return freshModule.exports;
  };

  /**
   * [getCached description]
   * @param  {string} id moduel identifier
   * @return {Module} cached module
   *
   * @public
   */
  Module.getCached = function (id) {
    return Module._cache[id];
  };

  /**
   * check if module file exists
   *
   * @param  {string} id module identifier
   * @return {boolean} whether the module exists
   * @public
   */
  Module.exists = function (id) {
    const path = Ti.Filesystem.resourcesDirectory + id + '.js',
      file = Ti.Filesystem.getFile(path);

    if (file.exists()) {
      return true;
    }
    if (!this.platform) {
      return false;
    }

    const pFolderPath = Ti.Filesystem.resourcesDirectory + '/' + this.platform + '/' + id + '.js';
    const pFile = Ti.Filesystem.getFile(pFolderPath);
    return pFile.exists();
  };

  /**
   * shady xhrSync request
   *
   * @param  {string} file file to load
   * @param  {number} timeout in milliseconds
   * @return {(string|boolean)} file contents if successful, false if not
   * @private
   */
  Module.prototype._getRemoteSource = function (file, timeout) {
    const expireTime = new Date().getTime() + timeout;
    const request = Ti.Network.createHTTPClient({
      waitsForConnectivity: true
    });
    let rsp = null;
    let done = false;
    const url = 'http://' + Module._url + ':' + Module._port + '/' + (file || this.id) + '.js';
    request.cache = false;
    request.open('GET', url);
    request.setRequestHeader('x-platform', this.platform);
    request.send();

    //
    // Windows only private API: _waitForResponse() waits for the response from the server.
    //
    if (this.platform === 'windows' && request._waitForResponse) {
      request._waitForResponse();
      if (request.readyState === 4 || request.status === 404) {
        rsp = request.status === 200 ? request.responseText : false;
      } else {
        throw new Error('[LiveView] File Server unavailable. Host Unreachable @ ' + Module._url + ':' + Module._port + '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.');
      }
      done = true;
    }

    while (!done) {
      if (request.readyState === 4 || request.status === 404) {
        rsp = request.status === 200 ? request.responseText : false;
        done = true;
      } else if (expireTime - new Date().getTime() <= 0) {
        rsp = false;
        done = true;
        throw new Error('[LiveView] File Server unavailable. Host Unreachable @ ' +
        Module._url + ':' + Module._port +
        '\n[LiveView] Please ensure your device and computer are on the same network and the port is not blocked.');
      }
    }

    return rsp;
  };

  /**
   * get module file source text
   * @return {string}
   * @private
   */
  Module.prototype._getSource = function () {
    let id = this.id;
    const isRemote = /^(http|https)$/.test(id) || global$1.ENV === 'liveview';
    if (isRemote) {
      return this._getRemoteSource(null, 10000);
    } else {
      if (id === 'app') {
        id = '_app';
      }
      const file = Ti.Filesystem.getFile(Ti.Filesystem.resourcesDirectory, id + '.js');
      return (file.read() || {}).text;
    }
  };

  /**
   * wrap module source text in commonjs anon function wrapper
   *
   * @param  {string} source The raw source we're wrapping in an IIFE
   * @return {string}
   * @private
   */
  Module._wrap = function (source) {
    return global$1.CATCH_ERRORS ? Module._errWrapper[0] + source + Module._errWrapper[1] : source;
  };

  // uncaught exception handler wrapper
  Module._errWrapper = [
  'try {\n',
  '\n} catch (err) {\nlvGlobal.process.emit("uncaughtException", {module: __filename, error: err, source: module.source});\n}'];


  /**
   * compile commonjs module and string to js
   *
   * @private
   */
  Module.prototype._compile = function () {
    const src = this._getSource();
    if (!src) {
      this.exports = Module._requireNative(this.id);
      this.loaded = true;
      return;
    }
    Module._compileList.push(this.id);
    this.source = Module._wrap(src);
    try {
      const fn = new Function('exports, require, module, __filename, __dirname, lvGlobal, L', this.source); // eslint-disable-line no-new-func
      fn(this.exports, Module.require, this, this.filename, this.__dirname, global$1, L);
    } catch (err) {
      process.emit('uncaughtException', { module: this.id, error: err, source: ('' + this.source).split('\n') });
    }

    Module._compileList.pop();
    this.loaded = true;
  };

  /**
   * cache current module
   *
   * @public
   */
  Module.prototype.cache = function () {
    this.timestamp = new Date().getTime();
    Module._cache[this.id] = this;
  };

  /**
   * liveview Titanium CommonJS require with some Node.js love and dirty hacks
   * Copyright (c) 2013-2017 Appcelerator
   */

  Object.setPrototypeOf = Object.setPrototypeOf || function (obj, proto) {
    // eslint-disable-next-line no-proto
    obj.__proto__ = proto;
    return obj;
  };

  Module.patch(global, '10.132.23.22', '8324');

  // Prevent display from sleeping

  Titanium.App.idleTimerDisabled = true;

})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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TUFBTSxDQUFDQyxjQUFjLElBQUksVUFBVXpDLEdBQUcsRUFBRWtNLEtBQUssRUFBRTtJQUN0RTtJQUNBbE0sR0FBRyxDQUFDbU0sU0FBUyxHQUFHRCxLQUFLO0lBQ3JCLE9BQU9sTSxHQUFHO0VBQ1gsQ0FBQzs7RUFFRG1GLE1BQU0sQ0FBQzhCLEtBQUssQ0FBQ2YsTUFBTSxFQUFFLGNBQWMsRUFBRSxNQUFNLENBQUM7O0VBRTVDOztFQUVBa0csUUFBUSxDQUFDekUsR0FBRyxDQUFDMEUsaUJBQWlCLEdBQUcsSUFBSTs7QUFFdEMsQ0FBQyxHQUFFIiwibmFtZXMiOlsiRW1pdHRlciIsIm9iaiIsIm1peGluIiwia2V5IiwicHJvdG90eXBlIiwib24iLCJldmVudCIsImZuIiwiX2NhbGxiYWNrcyIsInB1c2giLCJvbmNlIiwic2VsZiIsIm9mZiIsImFwcGx5IiwiYXJndW1lbnRzIiwiX29mZiIsImNhbGxiYWNrcyIsImxlbmd0aCIsImkiLCJpbmRleE9mIiwic3BsaWNlIiwiZW1pdCIsImFyZ3MiLCJzbGljZSIsImNhbGwiLCJsZW4iLCJsaXN0ZW5lcnMiLCJoYXNMaXN0ZW5lcnMiLCJQcm9jZXNzIiwidGl0bGUiLCJ2ZXJzaW9uIiwibW9kdWxlTG9hZExpc3QiLCJ2ZXJzaW9ucyIsImFyY2giLCJUaSIsIlBsYXRmb3JtIiwiYXJjaGl0ZWN0dXJlIiwicGxhdGZvcm0iLCJoYXJkd2FyZSIsIm1vZGVsIiwicmVwbGFjZSIsIk9iamVjdCIsInNldFByb3RvdHlwZU9mIiwiU29ja2V0Iiwib3B0cyIsInRpbWVvdXQiLCJob3N0IiwicG9ydCIsInJldHJ5IiwiYnl0ZXNSZWFkIiwiYnl0ZXNXcml0dGVuIiwiaWdub3JlIiwiY29ubmVjdCIsInJlQ29ubmVjdCIsIl9wcm94eSIsIk5ldHdvcmsiLCJjcmVhdGVUQ1AiLCJjb25uZWN0ZWQiLCJlIiwiX2Nvbm5lY3Rpb24iLCJzb2NrZXQiLCJTdHJlYW0iLCJwdW1wIiwiYnl0ZXNQcm9jZXNzZWQiLCJlcnJvclN0YXR1cyIsImNsb3NlIiwiYnVmZmVyIiwiZXJyb3IiLCJjb2RlIiwic2VydmVyRW5kZWQiLCJjbG9zaW5nIiwid3JpdGUiLCJzZXRUaW1lb3V0IiwiZGF0YSIsIm1zZyIsImNyZWF0ZUJ1ZmZlciIsInZhbHVlIiwiY2FsbGJhY2siLCJzZXRLZWVwQWxpdmUiLCJlbmFibGUiLCJpbml0aWFsRGVsYXkiLCJfa2VlcEFsaXZlIiwiY2xlYXJJbnRlcnZhbCIsInNldEludGVydmFsIiwiTW9kdWxlIiwiaWQiLCJmaWxlbmFtZSIsInByb2Nlc3MiLCJleHBvcnRzIiwibG9hZGVkIiwiTCIsIm5hbWUiLCJmaWxsZXIiLCJfZ2xvYmFsQ3R4IiwibG9jYWxlU3RyaW5ncyIsIkxvY2FsZSIsImN1cnJlbnRMYW5ndWFnZSIsImdsb2JhbCQxIiwiX2dsb2JhbCIsImdsb2JhbCIsImVyciIsImNvbnNvbGUiLCJsb2ciLCJtb2R1bGUiLCJsaW5lIiwic291cmNlSWQiLCJiYWNrdHJhY2UiLCJFTlYiLCJsb2dnaW5nIiwiQ0FUQ0hfRVJST1JTIiwiX2NhY2hlIiwiX3JlcXVpcmVOYXRpdmUiLCJFcnJvciIsIl9pbmNsdWRlTmF0aXZlIiwicGF0Y2giLCJnbG9iYWxDdHgiLCJ1cmwiLCJkZWZhdWx0VVJMIiwiX3VybCIsIl9wb3J0IiwicGFyc2VJbnQiLCJyZXF1aXJlIiwiZXZ0U2VydmVyIiwiX2NvbXBpbGVMaXN0IiwiQXBwIiwiUHJvcGVydGllcyIsInNldEJvb2wiLCJjb25uZWN0U2VydmVyIiwicmVsb2FkIiwiX3Jlc3RhcnQiLCJyZXRyeUludGVydmFsIiwiY2xpZW50IiwiZXZ0IiwiSlNPTiIsInBhcnNlIiwidHlwZSIsImluY2x1ZGUiLCJjdHgiLCJmaWxlIiwic3JjIiwiX2dldFJlbW90ZVNvdXJjZSIsImV2YWwiLCJ0b0Fic29sdXRlIiwicGFyZW50IiwicmVsYXRpdmUiLCJuZXdQYXRoIiwic3BsaXQiLCJwYXJ0cyIsInBvcCIsImpvaW4iLCJmdWxsUGF0aCIsImNhY2hlZCIsImdldENhY2hlZCIsImV4aXN0cyIsImhsRGlyIiwibW9kTG93ZXJDYXNlIiwidG9Mb3dlckNhc2UiLCJsYXN0SW5kZXgiLCJsYXN0SW5kZXhPZiIsInRlbXBQYXRoIiwiZnJlc2hNb2R1bGUiLCJjYWNoZSIsIl9jb21waWxlIiwicGF0aCIsIkZpbGVzeXN0ZW0iLCJyZXNvdXJjZXNEaXJlY3RvcnkiLCJnZXRGaWxlIiwicEZvbGRlclBhdGgiLCJwRmlsZSIsImV4cGlyZVRpbWUiLCJEYXRlIiwiZ2V0VGltZSIsInJlcXVlc3QiLCJjcmVhdGVIVFRQQ2xpZW50Iiwid2FpdHNGb3JDb25uZWN0aXZpdHkiLCJyc3AiLCJkb25lIiwib3BlbiIsInNldFJlcXVlc3RIZWFkZXIiLCJzZW5kIiwiX3dhaXRGb3JSZXNwb25zZSIsInJlYWR5U3RhdGUiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiLCJfZ2V0U291cmNlIiwiaXNSZW1vdGUiLCJ0ZXN0IiwicmVhZCIsInRleHQiLCJfd3JhcCIsInNvdXJjZSIsIl9lcnJXcmFwcGVyIiwiRnVuY3Rpb24iLCJfX2Rpcm5hbWUiLCJ0aW1lc3RhbXAiLCJwcm90byIsIl9fcHJvdG9fXyIsIlRpdGFuaXVtIiwiaWRsZVRpbWVyRGlzYWJsZWQiXSwic291cmNlUm9vdCI6Ii92YXIvZm9sZGVycy9tcS9fMnRmbmtxMTI1ZzhiYnBmNXduZjZ2YncwMDAwZ24vVCIsInNvdXJjZXMiOlsibGl2ZXZpZXcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uICgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdC8qXG5cdCAqIEV2ZW50IEVtaXR0ZXJzXG5cdCAqL1xuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplIGEgbmV3IGBFbWl0dGVyYC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iaiBPYmplY3QgdG8gYmUgbWl4ZWQgaW4gdG8gZW1pdHRlclxuXHQgKiBAcmV0dXJucyB7RW1pdHRlcn1cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0ZnVuY3Rpb24gRW1pdHRlcihvYmopIHtcblx0XHRpZiAob2JqKSB7XG5cdFx0XHRyZXR1cm4gbWl4aW4ob2JqKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTWl4aW4gdGhlIGVtaXR0ZXIgcHJvcGVydGllcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iaiBvYmplY3QgdG8gYmUgbWl4ZWQgaW5cblx0ICogQHJldHVybiB7T2JqZWN0fSBvYmplY3Qgd2l0aCBFbWl0dGVyIHByb3BlcnRpZXMgbWl4ZWQgaW5cblx0ICogQHByaXZhdGVcblx0ICovXG5cdGZ1bmN0aW9uIG1peGluKG9iaikge1xuXHRcdGZvciAoY29uc3Qga2V5IGluIEVtaXR0ZXIucHJvdG90eXBlKSB7XG5cdFx0XHRvYmpba2V5XSA9IEVtaXR0ZXIucHJvdG90eXBlW2tleV07XG5cdFx0fVxuXHRcdHJldHVybiBvYmo7XG5cdH1cblxuXHQvKipcblx0ICogTGlzdGVuIG9uIHRoZSBnaXZlbiBgZXZlbnRgIHdpdGggYGZuYC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50IGV2ZW50IG5hbWUgdG8gaG9vayBjYWxsYmFjayB0b1xuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBjYWxsYmFjayBmdW5jdGlvblxuXHQgKiBAcmV0dXJuIHtFbWl0dGVyfSB0aGlzXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGV2ZW50LCBmbikge1xuXHRcdHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblx0XHQodGhpcy5fY2FsbGJhY2tzW2V2ZW50XSA9IHRoaXMuX2NhbGxiYWNrc1tldmVudF0gfHwgW10pXG5cdFx0XHQucHVzaChmbik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIEFkZHMgYW4gYGV2ZW50YCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBhIHNpbmdsZVxuXHQgKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQgZXZlbnQgbmFtZSB0byBob29rIGNhbGxiYWNrIHRvXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIGNhbGxiYWNrIGZ1bmN0aW9uXG5cdCAqIEByZXR1cm4ge0VtaXR0ZXJ9IHRoaXNcblx0ICogQHB1YmxpY1xuXHQgKi9cblx0RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcblx0XHRjb25zdCBzZWxmID0gdGhpcztcblx0XHR0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cblx0XHQvKipcblx0XHQgKiBzaW5nbGUtZmlyZSBjYWxsYmFjayBmb3IgZXZlbnRcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvbigpIHtcblx0XHRcdHNlbGYub2ZmKGV2ZW50LCBvbik7XG5cdFx0XHRmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHRcdH1cblxuXHRcdGZuLl9vZmYgPSBvbjtcblx0XHR0aGlzLm9uKGV2ZW50LCBvbik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJlbW92ZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgZm9yIGBldmVudGAgb3IgYWxsXG5cdCAqIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQgZXZlbnQgbmFtZSB0byByZW1vdmUgY2FsbGJhY2sgZnJvbVxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBjYWxsYmFjayBmdW5jdGlvblxuXHQgKiBAcmV0dXJuIHtFbWl0dGVyfSB0aGlzXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcblx0XHR0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cdFx0bGV0IGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1tldmVudF07XG5cdFx0aWYgKCFjYWxsYmFja3MpIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdC8vIHJlbW92ZSBhbGwgaGFuZGxlcnNcblx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2NhbGxiYWNrc1tldmVudF07XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHQvLyByZW1vdmUgc3BlY2lmaWMgaGFuZGxlclxuXHRcdGNvbnN0IGkgPSBjYWxsYmFja3MuaW5kZXhPZihmbi5fb2ZmIHx8IGZuKTtcblx0XHRpZiAofmkpIHtcblx0XHRcdGNhbGxiYWNrcy5zcGxpY2UoaSwgMSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBFbWl0IGBldmVudGAgd2l0aCB0aGUgZ2l2ZW4gYXJncy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50IGV2ZW50IG5hbWVcblx0ICogQHJldHVybiB7RW1pdHRlcn1cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIChldmVudCkge1xuXHRcdHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblx0XHRjb25zdCBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXHRcdGxldCBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbZXZlbnRdO1xuXG5cdFx0aWYgKGNhbGxiYWNrcykge1xuXHRcdFx0Y2FsbGJhY2tzID0gY2FsbGJhY2tzLnNsaWNlKDApO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuXHRcdFx0XHRjYWxsYmFja3NbaV0uYXBwbHkodGhpcywgYXJncyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJldHVybiBhcnJheSBvZiBjYWxsYmFja3MgZm9yIGBldmVudGAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBldmVudCBldmVudCBuYW1lXG5cdCAqIEByZXR1cm4ge0FycmF5fSBhcnJheSBvZiBjYWxsYmFja3MgcmVnaXN0ZXJlZCBmb3IgdGhhdCBldmVudFxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0XHR0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cdFx0cmV0dXJuIHRoaXMuX2NhbGxiYWNrc1tldmVudF0gfHwgW107XG5cdH07XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoaXMgZW1pdHRlciBoYXMgYGV2ZW50YCBoYW5kbGVycy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50IGV2ZW50IG5hbWVcblx0ICogQHJldHVybiB7Ym9vbGVhbn1cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0RW1pdHRlci5wcm90b3R5cGUuaGFzTGlzdGVuZXJzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cdFx0cmV0dXJuICEhdGhpcy5saXN0ZW5lcnMoZXZlbnQpLmxlbmd0aDtcblx0fTtcblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBhIG5ldyBgUHJvY2Vzc2AuXG5cdCAqIEByZXR1cm5zIHtQcm9jZXNzfVxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRmdW5jdGlvbiBQcm9jZXNzKCkge1xuXHRcdGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9jZXNzKSkge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9jZXNzKCk7XG5cdFx0fVxuXHRcdHRoaXMudGl0bGUgPSAndGl0YW5pdW0nO1xuXHRcdHRoaXMudmVyc2lvbiA9ICcnO1xuXHRcdHRoaXMubW9kdWxlTG9hZExpc3QgPSBbXTtcblx0XHR0aGlzLnZlcnNpb25zID0ge307XG5cdFx0dGhpcy5hcmNoID0gVGkuUGxhdGZvcm0uYXJjaGl0ZWN0dXJlO1xuXHRcdHRoaXMucGxhdGZvcm0gPSBUaS5QbGF0Zm9ybS5vc25hbWU7XG5cdFx0dGhpcy5oYXJkd2FyZSA9ICgnJyArIFRpLlBsYXRmb3JtLm1vZGVsKS5yZXBsYWNlKCdnb29nbGVfJyk7XG5cdH1cblxuXHQvLyBpbmhlcml0IGZyb20gRXZlbnRFbWl0dGVyXG5cdE9iamVjdC5zZXRQcm90b3R5cGVPZihQcm9jZXNzLnByb3RvdHlwZSwgRW1pdHRlci5wcm90b3R5cGUpO1xuXG5cdC8qKlxuXHQgKiBbU29ja2V0IGRlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0cyBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm5zIHtTb2NrZXR9XG5cdCAqL1xuXHRmdW5jdGlvbiBTb2NrZXQob3B0cykge1xuXHRcdGlmICghKHRoaXMgaW5zdGFuY2VvZiBTb2NrZXQpKSB7XG5cdFx0XHRyZXR1cm4gbmV3IFNvY2tldChvcHRzKTtcblx0XHR9XG5cdFx0b3B0cyA9IG9wdHMgfHwge307XG5cdFx0dGhpcy50aW1lb3V0ID0gNTAwMDtcblx0XHR0aGlzLmhvc3QgPSBvcHRzLmhvc3Q7XG5cdFx0dGhpcy5wb3J0ID0gb3B0cy5wb3J0O1xuXHRcdHRoaXMucmV0cnkgPSBvcHRzLnJldHJ5O1xuXHRcdHRoaXMuYnl0ZXNSZWFkID0gMDtcblx0XHR0aGlzLmJ5dGVzV3JpdHRlbiA9IDA7XG5cdFx0dGhpcy5pZ25vcmUgPSBbXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbmhlcml0IGZyb20gYEVtaXR0ZXIucHJvdG90eXBlYC5cblx0ICovXG5cdE9iamVjdC5zZXRQcm90b3R5cGVPZihTb2NrZXQucHJvdG90eXBlLCBFbWl0dGVyLnByb3RvdHlwZSk7XG5cblx0LyoqXG5cdCAqIFtjb25uZWN0IGRlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0cyBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmbiAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdFNvY2tldC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uIChvcHRzLCBmbikge1xuXHRcdG9wdHMgPSBvcHRzIHx8IHt9O1xuXHRcdGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Zm4gPSBvcHRzO1xuXHRcdFx0b3B0cyA9IHt9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGYgPSB0aGlzO1xuXHRcdHNlbGYuaG9zdCA9IG9wdHMuaG9zdCB8fCBzZWxmLmhvc3QgfHwgJzEyNy4wLjAuMSc7XG5cdFx0c2VsZi5wb3J0ID0gb3B0cy5wb3J0IHx8IHNlbGYucG9ydDtcblx0XHRzZWxmLnJldHJ5ID0gb3B0cy5yZXRyeSB8fCBzZWxmLnJldHJ5O1xuXG5cdFx0Y29uc3QgcmVDb25uZWN0ID0gISFvcHRzLnJlQ29ubmVjdDtcblx0XHR0aGlzLl9wcm94eSA9IFRpLk5ldHdvcmsuU29ja2V0LmNyZWF0ZVRDUCh7XG5cdFx0XHRob3N0OiBzZWxmLmhvc3QsXG5cdFx0XHRwb3J0OiBzZWxmLnBvcnQsXG5cdFx0XHQvKipcblx0XHRcdCAqIFtkZXNjcmlwdGlvbl1cblx0XHRcdCAqIEBwYXJhbSAge09iamVjdH0gZSBbZGVzY3JpcHRpb25dXG5cdFx0XHQgKi9cblx0XHRcdGNvbm5lY3RlZDogZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0c2VsZi5jb25uZWN0ZWQgPSB0cnVlO1xuXHRcdFx0XHRzZWxmLl9jb25uZWN0aW9uID0gZS5zb2NrZXQ7XG5cdFx0XHRcdGZuICYmIGZuKGUpO1xuXHRcdFx0XHRzZWxmLmVtaXQoKChyZUNvbm5lY3QpID8gJ3JlY29ubmVjdCcgOiAnY29ubmVjdCcpLCBlKTtcblxuXHRcdFx0XHRUaS5TdHJlYW0ucHVtcChlLnNvY2tldCwgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0XHRpZiAoZS5ieXRlc1Byb2Nlc3NlZCA8IDAgfHwgISFlLmVycm9yU3RhdHVzKSB7XG5cdFx0XHRcdFx0XHRzZWxmLl9wcm94eS5jbG9zZSgpO1xuXHRcdFx0XHRcdFx0c2VsZi5jbG9zZSh0cnVlKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c2VsZi5lbWl0KCdkYXRhJywgJycgKyBlLmJ1ZmZlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAxMDI0LCB0cnVlKTtcblx0XHRcdH0sXG5cdFx0XHQvKipcblx0XHRcdCAqIFtkZXNjcmlwdGlvbl1cblx0XHRcdCAqIEBwYXJhbSAge09iamVjdH0gZSBbZGVzY3JpcHRpb25dXG5cdFx0XHQgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuXHRcdFx0ICovXG5cdFx0XHRlcnJvcjogZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0aWYgKCF+c2VsZi5pZ25vcmUuaW5kZXhPZihlLmNvZGUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNlbGYuZW1pdCgnZXJyb3InLCBlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLmVtaXQoJ2Vycm9yIGlnbm9yZWQnLCBlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX3Byb3h5LmNvbm5lY3QoKTtcblx0fTtcblxuXHQvKipcblx0ICogW2Nsb3NlIGRlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNlcnZlckVuZGVkIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdFNvY2tldC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoc2VydmVyRW5kZWQpIHtcblx0XHRjb25zdCBzZWxmID0gdGhpcztcblxuXHRcdHNlbGYuY29ubmVjdGVkID0gZmFsc2U7XG5cdFx0c2VsZi5jbG9zaW5nID0gIXNlcnZlckVuZGVkO1xuXG5cdFx0aWYgKHNlbGYuY2xvc2luZykge1xuXHRcdFx0c2VsZi53cml0ZShmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYuX3Byb3h5LmNsb3NlKCk7XG5cdFx0XHRcdHNlbGYuZW1pdCgnY2xvc2UnKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJldHJ5ID0gfn5zZWxmLnJldHJ5O1xuXG5cdFx0c2VsZi5lbWl0KCdlbmQnKTtcblx0XHRpZiAoIXJldHJ5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRzZWxmLmVtaXQoJ3JlY29ubmVjdGluZycpO1xuXHRcdFx0c2VsZi5jb25uZWN0KHsgcmVDb25uZWN0OiB0cnVlIH0pO1xuXHRcdH0sIHJldHJ5KTtcblx0fTtcblxuXHQvKipcblx0ICogW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9ICAgZGF0YSBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmbiAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdFNvY2tldC5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAoZGF0YSwgZm4pIHtcblx0XHRpZiAodHlwZW9mIGRhdGEgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGZuID0gZGF0YTtcblx0XHRcdGRhdGEgPSBudWxsO1xuXHRcdH1cblxuXHRcdGRhdGEgPSAoZGF0YSkgPyAgKCcnICsgZGF0YSkgOiAnJztcblxuXHRcdGNvbnN0IG1zZyA9IFRpLmNyZWF0ZUJ1ZmZlcih7IHZhbHVlOiAgZGF0YSB9KTtcblxuXHRcdGNvbnN0IGNhbGxiYWNrID0gZm4gfHwgZnVuY3Rpb24gKCkge307XG5cblx0XHRUaS5TdHJlYW0ud3JpdGUodGhpcy5fY29ubmVjdGlvbiwgbXNnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjYWxsYmFjayhbXS5zbGljZShhcmd1bWVudHMpKTtcblx0XHR9KTtcblxuXHR9O1xuXG5cdC8qKlxuXHQgKiBbc2V0S2VlcEFsaXZlIGRlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZSAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBpbml0aWFsRGVsYXkgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0U29ja2V0LnByb3RvdHlwZS5zZXRLZWVwQWxpdmUgPSBmdW5jdGlvbiAoZW5hYmxlLCBpbml0aWFsRGVsYXkpIHtcblx0XHRjb25zdCBzZWxmID0gdGhpcztcblx0XHRpZiAoIWVuYWJsZSkge1xuXHRcdFx0c2VsZi5fa2VlcEFsaXZlICYmIGNsZWFySW50ZXJ2YWwoc2VsZi5fa2VlcEFsaXZlKTtcblx0XHRcdHNlbGYuX2tlZXBBbGl2ZSA9IG51bGw7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHNlbGYuX2tlZXBBbGl2ZSA9IHNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcblx0XHRcdHNlbGYud3JpdGUoJ3BpbmcnKTtcblx0XHR9LCBpbml0aWFsRGVsYXkgfHwgMzAwMDAwKTtcblx0fTtcblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBhIG5ldyBgTW9kdWxlYC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGlkIFRoZSBtb2R1bGUgaWRlbnRpZmllclxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRmdW5jdGlvbiBNb2R1bGUoaWQpIHtcblx0XHR0aGlzLmZpbGVuYW1lID0gaWQgKyAnLmpzJztcblx0XHR0aGlzLmlkID0gaWQ7XG5cdFx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdpcGFkJykge1xuXHRcdFx0dGhpcy5wbGF0Zm9ybSA9ICdpcGhvbmUnO1xuXHRcdH0gZWxzZSBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbmRvd3NwaG9uZScgfHwgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbmRvd3NzdG9yZScpIHtcblx0XHRcdHRoaXMucGxhdGZvcm0gPSAnd2luZG93cyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtO1xuXHRcdH1cblx0XHR0aGlzLmV4cG9ydHMgPSB7fTtcblx0XHR0aGlzLmxvYWRlZCA9IGZhbHNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gTChuYW1lLCBmaWxsZXIpIHtcblx0XHRyZXR1cm4gKE1vZHVsZS5fZ2xvYmFsQ3R4LmxvY2FsZVN0cmluZ3NbVGkuTG9jYWxlLmN1cnJlbnRMYW5ndWFnZV0gfHwge30pW25hbWVdIHx8IGZpbGxlciB8fCBuYW1lO1xuXHR9XG5cblx0Ly8gZ2xvYmFsIG5hbWVzcGFjZVxuXHRjb25zdCBnbG9iYWwkMSA9IE1vZHVsZS5fZ2xvYmFsID0gTW9kdWxlLmdsb2JhbCA9IHt9O1xuXG5cdC8vIG1haW4gcHJvY2Vzc1xuXHRjb25zdCBwcm9jZXNzID0gZ2xvYmFsJDEucHJvY2VzcyA9IG5ldyBQcm9jZXNzKCk7XG5cdHByb2Nlc3Mub24oJ3VuY2F1Z2h0RXhjZXB0aW9uJywgZnVuY3Rpb24gKGVycikge1xuXHRcdGNvbnNvbGUubG9nKCdbTGl2ZVZpZXddIEVycm9yIEV2YWx1YXRpbmcnLCBlcnIubW9kdWxlLCAnQCBMaW5lOicsIGVyci5lcnJvci5saW5lKTtcblx0XHQvLyBjb25zb2xlLmVycm9yKCdMaW5lICcgKyBlcnIuZXJyb3IubGluZSwgJzonLCBlcnIuc291cmNlW2Vyci5lcnJvci5saW5lXSk7XG5cdFx0Y29uc29sZS5lcnJvcignJyArIGVyci5lcnJvcik7XG5cdFx0Y29uc29sZS5lcnJvcignRmlsZTonLCBlcnIubW9kdWxlKTtcblx0XHRjb25zb2xlLmVycm9yKCdMaW5lOicsIGVyci5lcnJvci5saW5lKTtcblx0XHRjb25zb2xlLmVycm9yKCdTb3VyY2VJZDonLCBlcnIuZXJyb3Iuc291cmNlSWQpO1xuXHRcdGNvbnNvbGUuZXJyb3IoJ0JhY2t0cmFjZTpcXG4nLCAoJycgKyBlcnIuZXJyb3IuYmFja3RyYWNlKS5yZXBsYWNlKC8nXFxuJy9nLCAnXFxuJykpO1xuXHR9KTtcblxuXHQvLyBzZXQgZW52aXJvbm1lbnQgdHlwZVxuXHRnbG9iYWwkMS5FTlYgPSAnbGl2ZXZpZXcnO1xuXG5cdC8vIHNldCBsb2dnaW5nXG5cdGdsb2JhbCQxLmxvZ2dpbmcgPSBmYWxzZTtcblxuXHQvLyBjYXRjaCB1bmNhdWdodCBlcnJvcnNcblx0Z2xvYmFsJDEuQ0FUQ0hfRVJST1JTID0gdHJ1ZTtcblxuXHQvLyBtb2R1bGUgY2FjaGVcblx0TW9kdWxlLl9jYWNoZSA9IHt9O1xuXG5cdC8qKlxuXHQgKiBwbGFjZSBob2xkZXIgZm9yIG5hdGl2ZSByZXF1aXJlIHVudGlsIHBhdGNoZWRcblx0ICpcblx0ICogQHByaXZhdGVcblx0ICovXG5cdE1vZHVsZS5fcmVxdWlyZU5hdGl2ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01vZHVsZS5wYXRjaCBtdXN0IGJlIHJ1biBmaXJzdCcpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBwbGFjZSBob2xkZXIgZm9yIG5hdGl2ZSByZXF1aXJlIHVudGlsIHBhdGNoZWRcblx0ICpcblx0ICogQHByaXZhdGVcblx0ICovXG5cdE1vZHVsZS5faW5jbHVkZU5hdGl2ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01vZHVsZS5wYXRjaCBtdXN0IGJlIHJ1biBmaXJzdCcpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiByZXBsYWNlIGJ1aWx0IGluIGByZXF1aXJlYCBmdW5jdGlvblxuXHQgKlxuXHQgKiBAcGFyYW0gIHtPYmplY3R9IGdsb2JhbEN0eCBHbG9iYWwgY29udGV4dFxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHVybCBUaGUgVVJMIHRvIHVzZSAoZGVmYXVsdCBpcyAnMTI3LjAuMC4xJywgb3IgJzEwLjAuMi4yJyBvbiBhbmRyb2lkIGVtdWxhdG9yKVxuXHQgKiBAcGFyYW0gIHtudW1iZXJ9IHBvcnQgVGhlIHBvcnQgdG8gdXNlIChkZWZhdWx0IGlzIDgzMjQpXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRNb2R1bGUucGF0Y2ggPSBmdW5jdGlvbiAoZ2xvYmFsQ3R4LCB1cmwsIHBvcnQpIHtcblx0XHRjb25zdCAgZGVmYXVsdFVSTCA9IChwcm9jZXNzLnBsYXRmb3JtID09PSAnYW5kcm9pZCcgJiYgcHJvY2Vzcy5oYXJkd2FyZSA9PT0gJ3NkaycpXG5cdFx0XHQ/ICcxMC4wLjIuMidcblx0XHRcdDogKFRpLlBsYXRmb3JtLm1vZGVsID09PSAnU2ltdWxhdG9yJyA/ICcxMjcuMC4wLjEnIDogJzEwLjEzMi4yMy4yMicpO1xuXHRcdE1vZHVsZS5fZ2xvYmFsQ3R4ID0gZ2xvYmFsQ3R4O1xuXHRcdGdsb2JhbCQxLl9nbG9iYWxDdHggPSBnbG9iYWxDdHg7XG5cdFx0TW9kdWxlLl91cmwgPSB1cmwgfHwgZGVmYXVsdFVSTDtcblx0XHRNb2R1bGUuX3BvcnQgPSBwYXJzZUludChwb3J0LCAxMCkgfHwgODMyNDtcblx0XHRNb2R1bGUuX3JlcXVpcmVOYXRpdmUgPSByZXF1aXJlO1xuXHRcdE1vZHVsZS5ldnRTZXJ2ZXIgJiYgTW9kdWxlLmV2dFNlcnZlci5jbG9zZSgpO1xuXHRcdE1vZHVsZS5fY29tcGlsZUxpc3QgPSBbXTtcblxuXHRcdC8vIEZJWCBmb3IgYW5kcm9pZCBidWdcblx0XHR0cnkge1xuXHRcdFx0VGkuQXBwLlByb3BlcnRpZXMuc2V0Qm9vbCgndGkuYW5kcm9pZC5idWcyMzczLmZpbmlzaGZhbHNlcm9vdCcsIGZhbHNlKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHQvLyBpZ25vcmVcblx0XHR9XG5cblx0XHRnbG9iYWxDdHgubG9jYWxlU3RyaW5ncyA9IE1vZHVsZS5yZXF1aXJlKCdsb2NhbGVTdHJpbmdzJyk7XG5cdFx0TW9kdWxlLmNvbm5lY3RTZXJ2ZXIoKTtcblx0fTtcblxuXHQvKipcblx0ICogW3JlbG9hZCBkZXNjcmlwdGlvbl1cblx0ICovXG5cdE1vZHVsZS5nbG9iYWwucmVsb2FkID0gZnVuY3Rpb24gKCkge1xuXHRcdHRyeSB7XG5cdFx0XHRNb2R1bGUuZXZ0U2VydmVyLl9wcm94eS5jbG9zZSgpO1xuXHRcdFx0Y29uc29sZS5sb2coJ1tMaXZlVmlld10gUmVsb2FkaW5nIEFwcCcpO1xuXHRcdFx0VGkuQXBwLl9yZXN0YXJ0KCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ1tMaXZlVmlld10gUmVsb2FkaW5nIEFwcCB2aWEgTGVnYWN5IE1ldGhvZCcpO1xuXHRcdFx0TW9kdWxlLnJlcXVpcmUoJ2FwcCcpO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0TW9kdWxlLmNvbm5lY3RTZXJ2ZXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IHJldHJ5SW50ZXJ2YWwgPSBudWxsO1xuXHRcdGNvbnN0IGNsaWVudCA9IE1vZHVsZS5ldnRTZXJ2ZXIgPSBuZXcgU29ja2V0KHsgaG9zdDogTW9kdWxlLl91cmwsIHBvcnQ6IHBhcnNlSW50KCc4MzIzJywgMTApIH0sIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdbTGl2ZVZpZXddJywgJ0Nvbm5lY3RlZCB0byBFdmVudCBTZXJ2ZXInKTtcblx0XHR9KTtcblxuXHRcdGNsaWVudC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnW0xpdmVWaWV3XScsICdDbG9zZWQgUHJldmlvdXMgRXZlbnQgU2VydmVyIGNsaWVudCcpO1xuXHRcdH0pO1xuXG5cdFx0Y2xpZW50Lm9uKCdjb25uZWN0JywgZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKHJldHJ5SW50ZXJ2YWwgIT09IG51bGwpIHtcblx0XHRcdFx0Y2xlYXJJbnRlcnZhbChyZXRyeUludGVydmFsKTtcblx0XHRcdFx0Y29uc29sZS5sb2coJ1tMaXZlVmlld10nLCAnUmVjb25uZWN0ZWQgdG8gRXZlbnQgU2VydmVyJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjbGllbnQub24oJ2RhdGEnLCBmdW5jdGlvbiAoZGF0YSkge1xuXHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGV2dCA9IEpTT04ucGFyc2UoJycgKyBkYXRhKTtcblx0XHRcdFx0aWYgKGV2dC50eXBlID09PSAnZXZlbnQnICYmIGV2dC5uYW1lID09PSAncmVsb2FkJykge1xuXHRcdFx0XHRcdE1vZHVsZS5fY2FjaGUgPSB7fTtcblx0XHRcdFx0XHRNb2R1bGUuZ2xvYmFsLnJlbG9hZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7IC8qIGRpc2NhcmQgbm9uIEpTT04gZGF0YSBmb3Igbm93ICovIH1cblx0XHR9KTtcblxuXHRcdGNsaWVudC5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignW0xpdmVWaWV3XScsICdEaXNjb25uZWN0ZWQgZnJvbSBFdmVudCBTZXJ2ZXInKTtcblx0XHRcdHJldHJ5SW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdbTGl2ZVZpZXddJywgJ0F0dGVtcHRpbmcgcmVjb25uZWN0IHRvIEV2ZW50IFNlcnZlcicpO1xuXHRcdFx0XHRjbGllbnQuY29ubmVjdCgpO1xuXHRcdFx0fSwgMjAwMCk7XG5cdFx0fSk7XG5cblx0XHRjbGllbnQub24oJ2Vycm9yJywgZnVuY3Rpb24gKGUpIHtcblx0XHRcdGxldCBlcnIgPSBlLmVycm9yO1xuXHRcdFx0Y29uc3QgY29kZSA9IH5+ZS5jb2RlO1xuXHRcdFx0aWYgKHJldHJ5SW50ZXJ2YWwgIT09IG51bGwgJiYgY29kZSA9PT0gNjEpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29kZSA9PT0gNjEpIHtcblx0XHRcdFx0ZXJyID0gJ0V2ZW50IFNlcnZlciB1bmF2YWlsYWJsZS4gQ29ubmVjdGlvbiBSZWZ1c2VkIEAgJ1xuXHRcdFx0XHRcdCsgTW9kdWxlLl91cmwgKyAnOicgKyBNb2R1bGUuX3BvcnRcblx0XHRcdFx0XHQrICdcXG5bTGl2ZVZpZXddIFBsZWFzZSBlbnN1cmUgeW91ciBkZXZpY2UgYW5kIGNvbXB1dGVyIGFyZSBvbiB0aGUgc2FtZSBuZXR3b3JrIGFuZCB0aGUgcG9ydCBpcyBub3QgYmxvY2tlZC4nO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdbTGl2ZVZpZXddICcgKyBlcnIpO1xuXHRcdH0pO1xuXG5cdFx0Y2xpZW50LmNvbm5lY3QoKTtcblx0XHRNb2R1bGUucmVxdWlyZSgnYXBwJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIGluY2x1ZGUgc2NyaXB0IGxvYWRlclxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IGN0eCBjb250ZXh0XG5cdCAqIEBwYXJhbSAge3N0cmluZ30gaWQgbW9kdWxlIGlkZW50aWZpZXJcblx0ICogQHB1YmxpY1xuXHQgKi9cblx0TW9kdWxlLmluY2x1ZGUgPSBmdW5jdGlvbiAoY3R4LCBpZCkge1xuXHRcdGNvbnN0IGZpbGUgPSBpZC5yZXBsYWNlKCcuanMnLCAnJyksXG5cdFx0XHRzcmMgPSBNb2R1bGUucHJvdG90eXBlLl9nZXRSZW1vdGVTb3VyY2UoZmlsZSwgMTAwMDApO1xuXHRcdGV2YWwuY2FsbChjdHgsIHNyYyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZXZhbFxuXHR9O1xuXG5cdC8qKlxuXHQgKiBjb252ZXJ0IHJlbGF0aXZlIHRvIGFic29sdXRlIHBhdGhcblx0ICogQHBhcmFtICB7c3RyaW5nfSBwYXJlbnQgcGFyZW50IGZpbGUgcGF0aFxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHJlbGF0aXZlIHJlbGF0aXZlIHBhdGggaW4gcmVxdWlyZVxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGFic29sdXRlIHBhdGggb2YgdGhlIHJlcXVpcmVkIGZpbGVcblx0ICogQHB1YmxpY1xuXHQgKi9cblx0TW9kdWxlLnRvQWJzb2x1dGUgPSBmdW5jdGlvbiAocGFyZW50LCByZWxhdGl2ZSkge1xuXHRcdGxldCBuZXdQYXRoID0gcGFyZW50LnNwbGl0KCcvJyksXG5cdFx0XHRwYXJ0cyA9IHJlbGF0aXZlLnNwbGl0KCcvJyk7XG5cblx0XHRuZXdQYXRoLnBvcCgpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKHBhcnRzW2ldID09PSAnLicpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwYXJ0c1tpXSA9PT0gJy4uJykge1xuXHRcdFx0XHRuZXdQYXRoLnBvcCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3UGF0aC5wdXNoKHBhcnRzW2ldKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG5ld1BhdGguam9pbignLycpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBjb21tb25qcyBtb2R1bGUgbG9hZGVyXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gaWQgbW9kdWxlIGlkZW50aWZpZXJcblx0ICogQHJldHVybnMge09iamVjdH1cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0TW9kdWxlLnJlcXVpcmUgPSBmdW5jdGlvbiAoaWQpIHtcblx0XHRsZXQgZnVsbFBhdGggPSBpZDtcblxuXHRcdGlmIChmdWxsUGF0aC5pbmRleE9mKCcuLycpID09PSAwIHx8IGZ1bGxQYXRoLmluZGV4T2YoJy4uLycpID09PSAwKSB7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBNb2R1bGUuX2NvbXBpbGVMaXN0W01vZHVsZS5fY29tcGlsZUxpc3QubGVuZ3RoIC0gMV07XG5cdFx0XHRmdWxsUGF0aCA9IE1vZHVsZS50b0Fic29sdXRlKHBhcmVudCwgZnVsbFBhdGgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhY2hlZCA9IE1vZHVsZS5nZXRDYWNoZWQoZnVsbFBhdGgpIHx8IE1vZHVsZS5nZXRDYWNoZWQoZnVsbFBhdGgucmVwbGFjZSgnL2luZGV4JywgJycpKSB8fCBNb2R1bGUuZ2V0Q2FjaGVkKGZ1bGxQYXRoICsgJy9pbmRleCcpO1xuXG5cdFx0aWYgKGNhY2hlZCkge1xuXHRcdFx0cmV0dXJuIGNhY2hlZC5leHBvcnRzO1xuXHRcdH1cblxuXHRcdGlmICghTW9kdWxlLmV4aXN0cyhmdWxsUGF0aCkpIHtcblx0XHRcdGlmIChmdWxsUGF0aC5pbmRleE9mKCcvJykgPT09IDAgJiYgTW9kdWxlLmV4aXN0cyhmdWxsUGF0aCArICcvaW5kZXgnKSkge1xuXHRcdFx0XHRmdWxsUGF0aCArPSAnL2luZGV4Jztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGhsRGlyID0gJy9oeXBlcmxvb3AvJztcblx0XHRcdFx0aWYgKGZ1bGxQYXRoLmluZGV4T2YoJy4qJykgIT09IC0xKSB7XG5cdFx0XHRcdFx0ZnVsbFBhdGggPSBpZC5zbGljZSgwLCBpZC5sZW5ndGggLSAyKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG1vZExvd2VyQ2FzZSA9IGZ1bGxQYXRoLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdGlmIChNb2R1bGUuZXhpc3RzKGhsRGlyICsgZnVsbFBhdGgpKSB7XG5cdFx0XHRcdFx0ZnVsbFBhdGggPSBobERpciArIGZ1bGxQYXRoO1xuXHRcdFx0XHR9IGVsc2UgaWYgKE1vZHVsZS5leGlzdHMoaGxEaXIgKyBtb2RMb3dlckNhc2UpKSB7XG5cdFx0XHRcdFx0ZnVsbFBhdGggPSBobERpciArIG1vZExvd2VyQ2FzZTtcblx0XHRcdFx0fSBlbHNlIGlmIChmdWxsUGF0aC5pbmRleE9mKCcuJykgPT09IC0xICYmIE1vZHVsZS5leGlzdHMoaGxEaXIgKyBmdWxsUGF0aCArICcvJyArIGZ1bGxQYXRoKSkge1xuXHRcdFx0XHRcdGZ1bGxQYXRoID0gaGxEaXIgKyBmdWxsUGF0aCArICcvJyArIGZ1bGxQYXRoO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGZ1bGxQYXRoLmluZGV4T2YoJy4nKSA9PT0gLTEgJiYgTW9kdWxlLmV4aXN0cyhobERpciArIG1vZExvd2VyQ2FzZSArICcvJyArIG1vZExvd2VyQ2FzZSkpIHtcblx0XHRcdFx0XHRmdWxsUGF0aCA9IGhsRGlyICsgbW9kTG93ZXJDYXNlICsgJy8nICsgbW9kTG93ZXJDYXNlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGxhc3RJbmRleCA9IGZ1bGxQYXRoLmxhc3RJbmRleE9mKCcuJyk7XG5cdFx0XHRcdFx0Y29uc3QgdGVtcFBhdGggPSBobERpciArIGZ1bGxQYXRoLnNsaWNlKDAsIGxhc3RJbmRleCkgKyAnJCcgKyBmdWxsUGF0aC5zbGljZShsYXN0SW5kZXggKyAxKTtcblx0XHRcdFx0XHRpZiAoTW9kdWxlLmV4aXN0cyhmdWxsUGF0aCkpIHtcblx0XHRcdFx0XHRcdGZ1bGxQYXRoID0gdGVtcFBhdGg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnJlc2hNb2R1bGUgPSBuZXcgTW9kdWxlKGZ1bGxQYXRoKTtcblxuXHRcdGZyZXNoTW9kdWxlLmNhY2hlKCk7XG5cdFx0ZnJlc2hNb2R1bGUuX2NvbXBpbGUoKTtcblxuXHRcdHJldHVybiBmcmVzaE1vZHVsZS5leHBvcnRzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBbZ2V0Q2FjaGVkIGRlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIG1vZHVlbCBpZGVudGlmaWVyXG5cdCAqIEByZXR1cm4ge01vZHVsZX0gY2FjaGVkIG1vZHVsZVxuXHQgKlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRNb2R1bGUuZ2V0Q2FjaGVkID0gZnVuY3Rpb24gKGlkKSB7XG5cdFx0cmV0dXJuIE1vZHVsZS5fY2FjaGVbaWRdO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBjaGVjayBpZiBtb2R1bGUgZmlsZSBleGlzdHNcblx0ICpcblx0ICogQHBhcmFtICB7c3RyaW5nfSBpZCBtb2R1bGUgaWRlbnRpZmllclxuXHQgKiBAcmV0dXJuIHtib29sZWFufSB3aGV0aGVyIHRoZSBtb2R1bGUgZXhpc3RzXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdE1vZHVsZS5leGlzdHMgPSBmdW5jdGlvbiAoaWQpIHtcblx0XHRjb25zdCBwYXRoID0gVGkuRmlsZXN5c3RlbS5yZXNvdXJjZXNEaXJlY3RvcnkgKyBpZCArICcuanMnLFxuXHRcdFx0ZmlsZSA9IFRpLkZpbGVzeXN0ZW0uZ2V0RmlsZShwYXRoKTtcblxuXHRcdGlmIChmaWxlLmV4aXN0cygpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnBsYXRmb3JtKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcEZvbGRlclBhdGggPSBUaS5GaWxlc3lzdGVtLnJlc291cmNlc0RpcmVjdG9yeSArICcvJyArIHRoaXMucGxhdGZvcm0gKyAnLycgKyBpZCArICcuanMnO1xuXHRcdGNvbnN0IHBGaWxlID0gVGkuRmlsZXN5c3RlbS5nZXRGaWxlKHBGb2xkZXJQYXRoKTtcblx0XHRyZXR1cm4gcEZpbGUuZXhpc3RzKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIHNoYWR5IHhoclN5bmMgcmVxdWVzdFxuXHQgKlxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IGZpbGUgZmlsZSB0byBsb2FkXG5cdCAqIEBwYXJhbSAge251bWJlcn0gdGltZW91dCBpbiBtaWxsaXNlY29uZHNcblx0ICogQHJldHVybiB7KHN0cmluZ3xib29sZWFuKX0gZmlsZSBjb250ZW50cyBpZiBzdWNjZXNzZnVsLCBmYWxzZSBpZiBub3Rcblx0ICogQHByaXZhdGVcblx0ICovXG5cdE1vZHVsZS5wcm90b3R5cGUuX2dldFJlbW90ZVNvdXJjZSA9IGZ1bmN0aW9uIChmaWxlLCB0aW1lb3V0KSB7XG5cdFx0Y29uc3QgZXhwaXJlVGltZSAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRpbWVvdXQ7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IFRpLk5ldHdvcmsuY3JlYXRlSFRUUENsaWVudCh7XG5cdFx0XHR3YWl0c0ZvckNvbm5lY3Rpdml0eTogdHJ1ZVxuXHRcdH0pO1xuXHRcdGxldCByc3AgPSBudWxsO1xuXHRcdGxldCBkb25lID0gZmFsc2U7XG5cdFx0Y29uc3QgdXJsID0gJ2h0dHA6Ly8nICsgTW9kdWxlLl91cmwgKyAnOicgKyBNb2R1bGUuX3BvcnQgKyAnLycgKyAoZmlsZSB8fCB0aGlzLmlkKSArICcuanMnO1xuXHRcdHJlcXVlc3QuY2FjaGUgPSBmYWxzZTtcblx0XHRyZXF1ZXN0Lm9wZW4oJ0dFVCcsIHVybCk7XG5cdFx0cmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCd4LXBsYXRmb3JtJywgdGhpcy5wbGF0Zm9ybSk7XG5cdFx0cmVxdWVzdC5zZW5kKCk7XG5cblx0XHQvL1xuXHRcdC8vIFdpbmRvd3Mgb25seSBwcml2YXRlIEFQSTogX3dhaXRGb3JSZXNwb25zZSgpIHdhaXRzIGZvciB0aGUgcmVzcG9uc2UgZnJvbSB0aGUgc2VydmVyLlxuXHRcdC8vXG5cdFx0aWYgKHRoaXMucGxhdGZvcm0gPT09ICd3aW5kb3dzJyAmJiByZXF1ZXN0Ll93YWl0Rm9yUmVzcG9uc2UpIHtcblx0XHRcdHJlcXVlc3QuX3dhaXRGb3JSZXNwb25zZSgpO1xuXHRcdFx0aWYgKHJlcXVlc3QucmVhZHlTdGF0ZSA9PT0gNCB8fCByZXF1ZXN0LnN0YXR1cyA9PT0gNDA0KSB7XG5cdFx0XHRcdHJzcCA9IHJlcXVlc3Quc3RhdHVzID09PSAyMDAgPyByZXF1ZXN0LnJlc3BvbnNlVGV4dCA6IGZhbHNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdbTGl2ZVZpZXddIEZpbGUgU2VydmVyIHVuYXZhaWxhYmxlLiBIb3N0IFVucmVhY2hhYmxlIEAgJyArIE1vZHVsZS5fdXJsICsgJzonICsgTW9kdWxlLl9wb3J0ICsgJ1xcbltMaXZlVmlld10gUGxlYXNlIGVuc3VyZSB5b3VyIGRldmljZSBhbmQgY29tcHV0ZXIgYXJlIG9uIHRoZSBzYW1lIG5ldHdvcmsgYW5kIHRoZSBwb3J0IGlzIG5vdCBibG9ja2VkLicpO1xuXHRcdFx0fVxuXHRcdFx0ZG9uZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0d2hpbGUgKCFkb25lKSB7XG5cdFx0XHRpZiAocmVxdWVzdC5yZWFkeVN0YXRlID09PSA0IHx8IHJlcXVlc3Quc3RhdHVzID09PSA0MDQpIHtcblx0XHRcdFx0cnNwID0gKHJlcXVlc3Quc3RhdHVzID09PSAyMDApID8gcmVxdWVzdC5yZXNwb25zZVRleHQgOiBmYWxzZTtcblx0XHRcdFx0ZG9uZSA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKChleHBpcmVUaW1lIC0gIChuZXcgRGF0ZSgpKS5nZXRUaW1lKCkpIDw9IDApIHtcblx0XHRcdFx0cnNwID0gZmFsc2U7XG5cdFx0XHRcdGRvbmUgPSB0cnVlO1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1tMaXZlVmlld10gRmlsZSBTZXJ2ZXIgdW5hdmFpbGFibGUuIEhvc3QgVW5yZWFjaGFibGUgQCAnXG5cdFx0XHRcdFx0KyBNb2R1bGUuX3VybCArICc6JyArIE1vZHVsZS5fcG9ydFxuXHRcdFx0XHRcdCsgJ1xcbltMaXZlVmlld10gUGxlYXNlIGVuc3VyZSB5b3VyIGRldmljZSBhbmQgY29tcHV0ZXIgYXJlIG9uIHRoZSBzYW1lIG5ldHdvcmsgYW5kIHRoZSBwb3J0IGlzIG5vdCBibG9ja2VkLicpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByc3A7XG5cdH07XG5cblx0LyoqXG5cdCAqIGdldCBtb2R1bGUgZmlsZSBzb3VyY2UgdGV4dFxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRNb2R1bGUucHJvdG90eXBlLl9nZXRTb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IGlkID0gdGhpcy5pZDtcblx0XHRjb25zdCBpc1JlbW90ZSA9IC9eKGh0dHB8aHR0cHMpJC8udGVzdChpZCkgfHwgKGdsb2JhbCQxLkVOViA9PT0gJ2xpdmV2aWV3Jyk7XG5cdFx0aWYgKGlzUmVtb3RlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0UmVtb3RlU291cmNlKG51bGwsIDEwMDAwKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGlkID09PSAnYXBwJykge1xuXHRcdFx0XHRpZCA9ICdfYXBwJztcblx0XHRcdH1cblx0XHRcdGNvbnN0IGZpbGUgPSBUaS5GaWxlc3lzdGVtLmdldEZpbGUoVGkuRmlsZXN5c3RlbS5yZXNvdXJjZXNEaXJlY3RvcnksIGlkICsgJy5qcycpO1xuXHRcdFx0cmV0dXJuIChmaWxlLnJlYWQoKSB8fCB7fSkudGV4dDtcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIHdyYXAgbW9kdWxlIHNvdXJjZSB0ZXh0IGluIGNvbW1vbmpzIGFub24gZnVuY3Rpb24gd3JhcHBlclxuXHQgKlxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHNvdXJjZSBUaGUgcmF3IHNvdXJjZSB3ZSdyZSB3cmFwcGluZyBpbiBhbiBJSUZFXG5cdCAqIEByZXR1cm4ge3N0cmluZ31cblx0ICogQHByaXZhdGVcblx0ICovXG5cdE1vZHVsZS5fd3JhcCA9IGZ1bmN0aW9uIChzb3VyY2UpIHtcblx0XHRyZXR1cm4gKGdsb2JhbCQxLkNBVENIX0VSUk9SUykgPyBNb2R1bGUuX2VycldyYXBwZXJbMF0gKyBzb3VyY2UgKyBNb2R1bGUuX2VycldyYXBwZXJbMV0gOiBzb3VyY2U7XG5cdH07XG5cblx0Ly8gdW5jYXVnaHQgZXhjZXB0aW9uIGhhbmRsZXIgd3JhcHBlclxuXHRNb2R1bGUuX2VycldyYXBwZXIgPSBbXG5cdFx0J3RyeSB7XFxuJyxcblx0XHQnXFxufSBjYXRjaCAoZXJyKSB7XFxubHZHbG9iYWwucHJvY2Vzcy5lbWl0KFwidW5jYXVnaHRFeGNlcHRpb25cIiwge21vZHVsZTogX19maWxlbmFtZSwgZXJyb3I6IGVyciwgc291cmNlOiBtb2R1bGUuc291cmNlfSk7XFxufSdcblx0XTtcblxuXHQvKipcblx0ICogY29tcGlsZSBjb21tb25qcyBtb2R1bGUgYW5kIHN0cmluZyB0byBqc1xuXHQgKlxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0TW9kdWxlLnByb3RvdHlwZS5fY29tcGlsZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzcmMgPSB0aGlzLl9nZXRTb3VyY2UoKTtcblx0XHRpZiAoIXNyYykge1xuXHRcdFx0dGhpcy5leHBvcnRzID0gTW9kdWxlLl9yZXF1aXJlTmF0aXZlKHRoaXMuaWQpO1xuXHRcdFx0dGhpcy5sb2FkZWQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRNb2R1bGUuX2NvbXBpbGVMaXN0LnB1c2godGhpcy5pZCk7XG5cdFx0dGhpcy5zb3VyY2UgPSBNb2R1bGUuX3dyYXAoc3JjKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZm4gPSBuZXcgRnVuY3Rpb24oJ2V4cG9ydHMsIHJlcXVpcmUsIG1vZHVsZSwgX19maWxlbmFtZSwgX19kaXJuYW1lLCBsdkdsb2JhbCwgTCcsIHRoaXMuc291cmNlKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuXHRcdFx0Zm4odGhpcy5leHBvcnRzLCBNb2R1bGUucmVxdWlyZSwgdGhpcywgdGhpcy5maWxlbmFtZSwgdGhpcy5fX2Rpcm5hbWUsIGdsb2JhbCQxLCBMKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHByb2Nlc3MuZW1pdCgndW5jYXVnaHRFeGNlcHRpb24nLCB7IG1vZHVsZTogdGhpcy5pZCwgZXJyb3I6IGVyciwgc291cmNlOiAoJycgKyB0aGlzLnNvdXJjZSkuc3BsaXQoJ1xcbicpIH0pO1xuXHRcdH1cblxuXHRcdE1vZHVsZS5fY29tcGlsZUxpc3QucG9wKCk7XG5cdFx0dGhpcy5sb2FkZWQgPSB0cnVlO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBjYWNoZSBjdXJyZW50IG1vZHVsZVxuXHQgKlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRNb2R1bGUucHJvdG90eXBlLmNhY2hlID0gZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZXN0YW1wID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblx0XHRNb2R1bGUuX2NhY2hlW3RoaXMuaWRdID0gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogbGl2ZXZpZXcgVGl0YW5pdW0gQ29tbW9uSlMgcmVxdWlyZSB3aXRoIHNvbWUgTm9kZS5qcyBsb3ZlIGFuZCBkaXJ0eSBoYWNrc1xuXHQgKiBDb3B5cmlnaHQgKGMpIDIwMTMtMjAxNyBBcHBjZWxlcmF0b3Jcblx0ICovXG5cblx0T2JqZWN0LnNldFByb3RvdHlwZU9mID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8IGZ1bmN0aW9uIChvYmosIHByb3RvKSB7XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXByb3RvXG5cdFx0b2JqLl9fcHJvdG9fXyA9IHByb3RvO1xuXHRcdHJldHVybiBvYmo7XG5cdH07XG5cblx0TW9kdWxlLnBhdGNoKGdsb2JhbCwgJzEwLjEzMi4yMy4yMicsICc4MzI0Jyk7XG5cblx0Ly8gUHJldmVudCBkaXNwbGF5IGZyb20gc2xlZXBpbmdcblxuXHRUaXRhbml1bS5BcHAuaWRsZVRpbWVyRGlzYWJsZWQgPSB0cnVlO1xuXG59KCkpO1xuIl0sInZlcnNpb24iOjN9
