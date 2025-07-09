(function () {
  'use strict';

  /**
   * @param  {*} arg passed in argument value
   * @param  {string} name name of the argument
   * @param  {string} typename i.e. 'string', 'Function' (value is compared to typeof after lowercasing)
   * @return {void}
   * @throws {TypeError}
   */
  function assertArgumentType(arg, name, typename) {
    const type = typeof arg;
    if (type !== typename.toLowerCase()) {
      throw new TypeError(`The "${name}" argument must be of type ${typename}. Received type ${type}`);
    }
  }

  const FORWARD_SLASH = 47; // '/'
  const BACKWARD_SLASH = 92; // '\\'

  /**
   * Is this [a-zA-Z]?
   * @param  {number}  charCode value from String.charCodeAt()
   * @return {Boolean}          [description]
   */
  function isWindowsDeviceName(charCode) {
    return charCode >= 65 && charCode <= 90 || charCode >= 97 && charCode <= 122;
  }

  /**
   * [isAbsolute description]
   * @param  {boolean} isPosix whether this impl is for POSIX or not
   * @param  {string} filepath   input file path
   * @return {Boolean}          [description]
   */
  function isAbsolute(isPosix, filepath) {
    assertArgumentType(filepath, 'path', 'string');
    const length = filepath.length;
    // empty string special case
    if (length === 0) {
      return false;
    }
    const firstChar = filepath.charCodeAt(0);
    if (firstChar === FORWARD_SLASH) {
      return true;
    }
    // we already did our checks for posix
    if (isPosix) {
      return false;
    }
    // win32 from here on out
    if (firstChar === BACKWARD_SLASH) {
      return true;
    }
    if (length > 2 && isWindowsDeviceName(firstChar) && filepath.charAt(1) === ':') {
      const thirdChar = filepath.charAt(2);
      return thirdChar === '/' || thirdChar === '\\';
    }
    return false;
  }

  /**
   * [dirname description]
   * @param  {string} separator  platform-specific file separator
   * @param  {string} filepath   input file path
   * @return {string}            [description]
   */
  function dirname(separator, filepath) {
    assertArgumentType(filepath, 'path', 'string');
    const length = filepath.length;
    if (length === 0) {
      return '.';
    }

    // ignore trailing separator
    let fromIndex = length - 1;
    const hadTrailing = filepath.endsWith(separator);
    if (hadTrailing) {
      fromIndex--;
    }
    const foundIndex = filepath.lastIndexOf(separator, fromIndex);
    // no separators
    if (foundIndex === -1) {
      // handle special case of root windows paths
      if (length >= 2 && separator === '\\' && filepath.charAt(1) === ':') {
        const firstChar = filepath.charCodeAt(0);
        if (isWindowsDeviceName(firstChar)) {
          return filepath; // it's a root windows path
        }
      }

      return '.';
    }
    // only found root separator
    if (foundIndex === 0) {
      return separator; // if it was '/', return that
    }
    // Handle special case of '//something'
    if (foundIndex === 1 && separator === '/' && filepath.charAt(0) === '/') {
      return '//';
    }
    return filepath.slice(0, foundIndex);
  }

  /**
   * [extname description]
   * @param  {string} separator  platform-specific file separator
   * @param  {string} filepath   input file path
   * @return {string}            [description]
   */
  function extname(separator, filepath) {
    assertArgumentType(filepath, 'path', 'string');
    const index = filepath.lastIndexOf('.');
    if (index === -1 || index === 0) {
      return '';
    }
    // ignore trailing separator
    let endIndex = filepath.length;
    if (filepath.endsWith(separator)) {
      endIndex--;
    }
    return filepath.slice(index, endIndex);
  }
  function lastIndexWin32Separator(filepath, index) {
    for (let i = index; i >= 0; i--) {
      const char = filepath.charCodeAt(i);
      if (char === BACKWARD_SLASH || char === FORWARD_SLASH) {
        return i;
      }
    }
    return -1;
  }

  /**
   * [basename description]
   * @param  {string} separator  platform-specific file separator
   * @param  {string} filepath   input file path
   * @param  {string} [ext]      file extension to drop if it exists
   * @return {string}            [description]
   */
  function basename(separator, filepath, ext) {
    assertArgumentType(filepath, 'path', 'string');
    if (ext !== undefined) {
      assertArgumentType(ext, 'ext', 'string');
    }
    const length = filepath.length;
    if (length === 0) {
      return '';
    }
    const isPosix = separator === '/';
    let endIndex = length;
    // drop trailing separator (if there is one)
    const lastCharCode = filepath.charCodeAt(length - 1);
    if (lastCharCode === FORWARD_SLASH || !isPosix && lastCharCode === BACKWARD_SLASH) {
      endIndex--;
    }

    // Find last occurence of separator
    let lastIndex = -1;
    if (isPosix) {
      lastIndex = filepath.lastIndexOf(separator, endIndex - 1);
    } else {
      // On win32, handle *either* separator!
      lastIndex = lastIndexWin32Separator(filepath, endIndex - 1);
      // handle special case of root path like 'C:' or 'C:\\'
      if ((lastIndex === 2 || lastIndex === -1) && filepath.charAt(1) === ':' && isWindowsDeviceName(filepath.charCodeAt(0))) {
        return '';
      }
    }

    // Take from last occurrence of separator to end of string (or beginning to end if not found)
    const base = filepath.slice(lastIndex + 1, endIndex);

    // drop trailing extension (if specified)
    if (ext === undefined) {
      return base;
    }
    return base.endsWith(ext) ? base.slice(0, base.length - ext.length) : base;
  }

  /**
   * The `path.normalize()` method normalizes the given path, resolving '..' and '.' segments.
   *
   * When multiple, sequential path segment separation characters are found (e.g.
   * / on POSIX and either \ or / on Windows), they are replaced by a single
   * instance of the platform-specific path segment separator (/ on POSIX and \
   * on Windows). Trailing separators are preserved.
   *
   * If the path is a zero-length string, '.' is returned, representing the
   * current working directory.
   *
   * @param  {string} separator  platform-specific file separator
   * @param  {string} filepath  input file path
   * @return {string} [description]
   */
  function normalize(separator, filepath) {
    assertArgumentType(filepath, 'path', 'string');
    if (filepath.length === 0) {
      return '.';
    }

    // Windows can handle '/' or '\\' and both should be turned into separator
    const isWindows = separator === '\\';
    if (isWindows) {
      filepath = filepath.replace(/\//g, separator);
    }
    const hadLeading = filepath.startsWith(separator);
    // On Windows, need to handle UNC paths (\\host-name\\resource\\dir) special to retain leading double backslash
    const isUNC = hadLeading && isWindows && filepath.length > 2 && filepath.charAt(1) === '\\';
    const hadTrailing = filepath.endsWith(separator);
    const parts = filepath.split(separator);
    const result = [];
    for (const segment of parts) {
      if (segment.length !== 0 && segment !== '.') {
        if (segment === '..') {
          result.pop(); // FIXME: What if this goes above root? Should we throw an error?
        } else {
          result.push(segment);
        }
      }
    }
    let normalized = hadLeading ? separator : '';
    normalized += result.join(separator);
    if (hadTrailing) {
      normalized += separator;
    }
    if (isUNC) {
      normalized = '\\' + normalized;
    }
    return normalized;
  }

  /**
   * [assertSegment description]
   * @param  {*} segment [description]
   * @return {void}         [description]
   */
  function assertSegment(segment) {
    if (typeof segment !== 'string') {
      throw new TypeError(`Path must be a string. Received ${segment}`);
    }
  }

  /**
   * The `path.join()` method joins all given path segments together using the
   * platform-specific separator as a delimiter, then normalizes the resulting path.
   * Zero-length path segments are ignored. If the joined path string is a zero-
   * length string then '.' will be returned, representing the current working directory.
   * @param  {string} separator platform-specific file separator
   * @param  {string[]} paths [description]
   * @return {string}       The joined filepath
   */
  function join(separator, paths) {
    const result = [];
    // naive impl: just join all the paths with separator
    for (const segment of paths) {
      assertSegment(segment);
      if (segment.length !== 0) {
        result.push(segment);
      }
    }
    return normalize(separator, result.join(separator));
  }

  /**
   * The `path.resolve()` method resolves a sequence of paths or path segments into an absolute path.
   *
   * @param  {string} separator platform-specific file separator
   * @param  {string[]} paths [description]
   * @return {string}       [description]
   */
  function resolve(separator, paths) {
    let resolved = '';
    let hitRoot = false;
    const isPosix = separator === '/';
    // go from right to left until we hit absolute path/root
    for (let i = paths.length - 1; i >= 0; i--) {
      const segment = paths[i];
      assertSegment(segment);
      if (segment.length === 0) {
        continue; // skip empty
      }

      resolved = segment + separator + resolved; // prepend new segment
      if (isAbsolute(isPosix, segment)) {
        // have we backed into an absolute path?
        hitRoot = true;
        break;
      }
    }
    // if we didn't hit root, prepend cwd
    if (!hitRoot) {
      resolved = (global.process ? process.cwd() : '/') + separator + resolved;
    }
    const normalized = normalize(separator, resolved);
    if (normalized.charAt(normalized.length - 1) === separator) {
      // FIXME: Handle UNC paths on Windows as well, so we don't trim trailing separator on something like '\\\\host-name\\resource\\'
      // Don't remove trailing separator if this is root path on windows!
      if (!isPosix && normalized.length === 3 && normalized.charAt(1) === ':' && isWindowsDeviceName(normalized.charCodeAt(0))) {
        return normalized;
      }
      // otherwise trim trailing separator
      return normalized.slice(0, normalized.length - 1);
    }
    return normalized;
  }

  /**
   * The `path.relative()` method returns the relative path `from` from to `to` based
   * on the current working directory. If from and to each resolve to the same
   * path (after calling `path.resolve()` on each), a zero-length string is returned.
   *
   * If a zero-length string is passed as `from` or `to`, the current working directory
   * will be used instead of the zero-length strings.
   *
   * @param  {string} separator platform-specific file separator
   * @param  {string} from [description]
   * @param  {string} to   [description]
   * @return {string}      [description]
   */
  function relative(separator, from, to) {
    assertArgumentType(from, 'from', 'string');
    assertArgumentType(to, 'to', 'string');
    if (from === to) {
      return '';
    }
    from = resolve(separator, [from]);
    to = resolve(separator, [to]);
    if (from === to) {
      return '';
    }

    // we now have two absolute paths,
    // lets "go up" from `from` until we reach common base dir of `to`
    // const originalFrom = from;
    let upCount = 0;
    let remainingPath = '';
    while (true) {
      if (to.startsWith(from)) {
        // match! record rest...?
        remainingPath = to.slice(from.length);
        break;
      }
      // FIXME: Break/throw if we hit bad edge case of no common root!
      from = dirname(separator, from);
      upCount++;
    }
    // remove leading separator from remainingPath if there is any
    if (remainingPath.length > 0) {
      remainingPath = remainingPath.slice(1);
    }
    return ('..' + separator).repeat(upCount) + remainingPath;
  }

  /**
   * The `path.parse()` method returns an object whose properties represent
   * significant elements of the path. Trailing directory separators are ignored,
   * see `path.sep`.
   *
   * The returned object will have the following properties:
   *
   * - dir <string>
   * - root <string>
   * - base <string>
   * - name <string>
   * - ext <string>
   * @param  {string} separator platform-specific file separator
   * @param  {string} filepath [description]
   * @return {object}
   */
  function parse(separator, filepath) {
    assertArgumentType(filepath, 'path', 'string');
    const result = {
      root: '',
      dir: '',
      base: '',
      ext: '',
      name: ''
    };
    const length = filepath.length;
    if (length === 0) {
      return result;
    }

    // Cheat and just call our other methods for dirname/basename/extname?
    result.base = basename(separator, filepath);
    result.ext = extname(separator, result.base);
    const baseLength = result.base.length;
    result.name = result.base.slice(0, baseLength - result.ext.length);
    const toSubtract = baseLength === 0 ? 0 : baseLength + 1;
    result.dir = filepath.slice(0, filepath.length - toSubtract); // drop trailing separator!
    const firstCharCode = filepath.charCodeAt(0);
    // both win32 and POSIX return '/' root
    if (firstCharCode === FORWARD_SLASH) {
      result.root = '/';
      return result;
    }
    // we're done with POSIX...
    if (separator === '/') {
      return result;
    }
    // for win32...
    if (firstCharCode === BACKWARD_SLASH) {
      // FIXME: Handle UNC paths like '\\\\host-name\\resource\\file_path'
      // need to retain '\\\\host-name\\resource\\' as root in that case!
      result.root = '\\';
      return result;
    }
    // check for C: style root
    if (length > 1 && isWindowsDeviceName(firstCharCode) && filepath.charAt(1) === ':') {
      if (length > 2) {
        // is it like C:\\?
        const thirdCharCode = filepath.charCodeAt(2);
        if (thirdCharCode === FORWARD_SLASH || thirdCharCode === BACKWARD_SLASH) {
          result.root = filepath.slice(0, 3);
          return result;
        }
      }
      // nope, just C:, no trailing separator
      result.root = filepath.slice(0, 2);
    }
    return result;
  }

  /**
   * The `path.format()` method returns a path string from an object. This is the
   * opposite of `path.parse()`.
   *
   * @param  {string} separator platform-specific file separator
   * @param  {object} pathObject object of format returned by `path.parse()`
   * @param  {string} pathObject.dir directory name
   * @param  {string} pathObject.root file root dir, ignored if `pathObject.dir` is provided
   * @param  {string} pathObject.base file basename
   * @param  {string} pathObject.name basename minus extension, ignored if `pathObject.base` exists
   * @param  {string} pathObject.ext file extension, ignored if `pathObject.base` exists
   * @return {string}
   */
  function format(separator, pathObject) {
    assertArgumentType(pathObject, 'pathObject', 'object');
    const base = pathObject.base || `${pathObject.name || ''}${pathObject.ext || ''}`;

    // append base to root if `dir` wasn't specified, or if
    // dir is the root
    if (!pathObject.dir || pathObject.dir === pathObject.root) {
      return `${pathObject.root || ''}${base}`;
    }
    // combine dir + / + base
    return `${pathObject.dir}${separator}${base}`;
  }

  /**
   * On Windows systems only, returns an equivalent namespace-prefixed path for
   * the given path. If path is not a string, path will be returned without modifications.
   * See https://docs.microsoft.com/en-us/windows/desktop/FileIO/naming-a-file#namespaces
   * @param  {string} filepath [description]
   * @return {string}          [description]
   */
  function toNamespacedPath(filepath) {
    if (typeof filepath !== 'string') {
      return filepath;
    }
    if (filepath.length === 0) {
      return '';
    }
    const resolvedPath = resolve('\\', [filepath]);
    const length = resolvedPath.length;
    if (length < 2) {
      // need '\\\\' or 'C:' minimum
      return filepath;
    }
    const firstCharCode = resolvedPath.charCodeAt(0);
    // if start with '\\\\', prefix with UNC root, drop the slashes
    if (firstCharCode === BACKWARD_SLASH && resolvedPath.charAt(1) === '\\') {
      // return as-is if it's an aready long path ('\\\\?\\' or '\\\\.\\' prefix)
      if (length >= 3) {
        const thirdChar = resolvedPath.charAt(2);
        if (thirdChar === '?' || thirdChar === '.') {
          return filepath;
        }
      }
      return '\\\\?\\UNC\\' + resolvedPath.slice(2);
    } else if (isWindowsDeviceName(firstCharCode) && resolvedPath.charAt(1) === ':') {
      return '\\\\?\\' + resolvedPath;
    }
    return filepath;
  }
  const Win32Path = {
    sep: '\\',
    delimiter: ';',
    basename: function (filepath, ext) {
      return basename(this.sep, filepath, ext);
    },
    normalize: function (filepath) {
      return normalize(this.sep, filepath);
    },
    join: function () {
      for (var _len = arguments.length, paths = new Array(_len), _key = 0; _key < _len; _key++) {
        paths[_key] = arguments[_key];
      }
      return join(this.sep, paths);
    },
    extname: function (filepath) {
      return extname(this.sep, filepath);
    },
    dirname: function (filepath) {
      return dirname(this.sep, filepath);
    },
    isAbsolute: function (filepath) {
      return isAbsolute(false, filepath);
    },
    relative: function (from, to) {
      return relative(this.sep, from, to);
    },
    resolve: function () {
      for (var _len2 = arguments.length, paths = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        paths[_key2] = arguments[_key2];
      }
      return resolve(this.sep, paths);
    },
    parse: function (filepath) {
      return parse(this.sep, filepath);
    },
    format: function (pathObject) {
      return format(this.sep, pathObject);
    },
    toNamespacedPath: toNamespacedPath
  };
  const PosixPath = {
    sep: '/',
    delimiter: ':',
    basename: function (filepath, ext) {
      return basename(this.sep, filepath, ext);
    },
    normalize: function (filepath) {
      return normalize(this.sep, filepath);
    },
    join: function () {
      for (var _len3 = arguments.length, paths = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        paths[_key3] = arguments[_key3];
      }
      return join(this.sep, paths);
    },
    extname: function (filepath) {
      return extname(this.sep, filepath);
    },
    dirname: function (filepath) {
      return dirname(this.sep, filepath);
    },
    isAbsolute: function (filepath) {
      return isAbsolute(true, filepath);
    },
    relative: function (from, to) {
      return relative(this.sep, from, to);
    },
    resolve: function () {
      for (var _len4 = arguments.length, paths = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        paths[_key4] = arguments[_key4];
      }
      return resolve(this.sep, paths);
    },
    parse: function (filepath) {
      return parse(this.sep, filepath);
    },
    format: function (pathObject) {
      return format(this.sep, pathObject);
    },
    toNamespacedPath: function (filepath) {
      return filepath; // no-op
    }
  };

  const path = PosixPath;
  path.win32 = Win32Path;
  path.posix = PosixPath;

  /**
   * Titanium SDK
   * Copyright TiDev, Inc. 04/07/2022-Present. All Rights Reserved.
   * Licensed under the terms of the Apache Public License
   * Please see the LICENSE included with this distribution for details.
   */
  function bootstrap$2(global, kroll) {
    const assets = kroll.binding('assets');
    const Script = kroll.binding('Script');

    /**
     * The loaded index.json file from the app. Used to store the encrypted JS assets'
     * filenames/offsets.
     */
    let fileIndex;
    // FIXME: fix file name parity between platforms
    const INDEX_JSON = '/_index_.json';
    class Module {
      /**
       * [Module description]
       * @param {string} id      module id
       * @param {Module} parent  parent module
       */
      constructor(id, parent) {
        this.id = id;
        this.exports = {};
        this.parent = parent;
        this.filename = null;
        this.loaded = false;
        this.wrapperCache = {};
        this.isService = false; // toggled on if this module is the service entry point
      }

      /**
       * Attempts to load the module. If no file is found
       * with the provided name an exception will be thrown.
       * Once the contents of the file are read, it is run
       * in the current context. A sandbox is created by
       * executing the code inside a wrapper function.
       * This provides a speed boost vs creating a new context.
       *
       * @param  {String} filename [description]
       * @param  {String} source   [description]
       * @returns {void}
       */
      load(filename, source) {
        if (this.loaded) {
          throw new Error('Module already loaded.');
        }
        this.filename = filename;
        this.path = path.dirname(filename);
        this.paths = this.nodeModulesPaths(this.path);
        if (!source) {
          source = assets.readAsset(filename);
        }

        // Stick it in the cache
        Module.cache[this.filename] = this;
        this._runScript(source, this.filename);
        this.loaded = true;
      }

      /**
       * Generates a context-specific module wrapper, and wraps
       * each invocation API in an external (3rd party) module
       * See invoker.js for more info
       * @param  {object} externalModule native module proxy
       * @param  {string} sourceUrl      the current js file url
       * @return {object}                wrapper around the externalModule
       */
      createModuleWrapper(externalModule, sourceUrl) {
        {
          // iOS does not need a module wrapper, return original external module
          return externalModule;
        }
      }

      /**
       * Takes a CommonJS module and uses it to extend an existing external/native module. The exports are added to the external module.
       * @param  {Object} externalModule The external/native module we're extending
       * @param  {String} id             module id
       */
      extendModuleWithCommonJs(externalModule, id) {
        if (!kroll.isExternalCommonJsModule(id)) {
          return;
        }

        // Load under fake name, or the commonjs side of the native module gets cached in place of the native module!
        // See TIMOB-24932
        const fakeId = `${id}.commonjs`;
        const jsModule = new Module(fakeId, this);
        jsModule.load(fakeId, kroll.getExternalCommonJsModule(id));
        if (jsModule.exports) {
          console.trace(`Extending native module '${id}' with the CommonJS module that was packaged with it.`);
          kroll.extend(externalModule, jsModule.exports);
        }
      }

      /**
       * Loads a native / external (3rd party) module
       * @param  {String} id              module id
       * @param  {object} externalBinding external binding object
       * @return {Object}                 The exported module
       */
      loadExternalModule(id, externalBinding) {
        // try to get the cached module...
        let externalModule = Module.cache[id];
        if (!externalModule) {
          // iOS and Android differ quite a bit here.
          // With ios, we should already have the native module loaded
          // There's no special "bootstrap.js" file packaged within it
          // On Android, we load a bootstrap.js bundled with the module
          {
            externalModule = externalBinding;
          }
        }
        if (!externalModule) {
          console.trace(`Unable to load external module: ${id}`);
          return null;
        }

        // cache the loaded native module (before we extend it)
        Module.cache[id] = externalModule;

        // We cache each context-specific module wrapper
        // on the parent module, rather than in the Module.cache
        let wrapper = this.wrapperCache[id];
        if (wrapper) {
          return wrapper;
        }
        const sourceUrl = `app://${this.filename}`; // FIXME: If this.filename starts with '/', we need to drop it, I think?
        wrapper = this.createModuleWrapper(externalModule, sourceUrl);

        // Then we "extend" the API/module using any shipped JS code (assets/<module.id>.js)
        this.extendModuleWithCommonJs(wrapper, id);
        this.wrapperCache[id] = wrapper;
        return wrapper;
      }

      // See https://nodejs.org/api/modules.html#modules_all_together

      /**
       * Require another module as a child of this module.
       * This parent module's path is used as the base for relative paths
       * when loading the child. Returns the exports object
       * of the child module.
       *
       * @param  {String} request  The path to the requested module
       * @return {Object}          The loaded module
       */
      require(request) {
        // 2. If X begins with './' or '/' or '../'
        const start = request.substring(0, 2); // hack up the start of the string to check relative/absolute/"naked" module id
        if (start === './' || start === '..') {
          const loaded = this.loadAsFileOrDirectory(path.normalize(this.path + '/' + request));
          if (loaded) {
            return loaded.exports;
          }
          // Root/absolute path (internally when reading the file, we prepend "Resources/" as root dir)
        } else if (request.substring(0, 1) === '/') {
          const loaded = this.loadAsFileOrDirectory(path.normalize(request));
          if (loaded) {
            return loaded.exports;
          }
        } else {
          // Despite being step 1 in Node.JS psuedo-code, we moved it down here because we don't allow native modules
          // to start with './', '..' or '/' - so this avoids a lot of misses on requires starting that way

          // 1. If X is a core module,
          let loaded = this.loadCoreModule(request);
          if (loaded) {
            // a. return the core module
            // b. STOP
            return loaded;
          }

          // Look for CommonJS module
          if (request.indexOf('/') === -1) {
            // For CommonJS we need to look for module.id/module.id.js first...
            const filename = `/${request}/${request}.js`;
            // Only look for this _exact file_. DO NOT APPEND .js or .json to it!
            if (this.filenameExists(filename)) {
              loaded = this.loadJavascriptText(filename);
              if (loaded) {
                return loaded.exports;
              }
            }

            // Then try module.id as directory
            loaded = this.loadAsDirectory(`/${request}`);
            if (loaded) {
              return loaded.exports;
            }
          }

          // Allow looking through node_modules
          // 3. LOAD_NODE_MODULES(X, dirname(Y))
          loaded = this.loadNodeModules(request, this.paths);
          if (loaded) {
            return loaded.exports;
          }

          // Fallback to old Titanium behavior of assuming it's actually an absolute path

          // We'd like to warn users about legacy style require syntax so they can update, but the new syntax is not backwards compatible.
          // So for now, let's just be quite about it. In future versions of the SDK (7.0?) we should warn (once 5.x is end of life so backwards compat is not necessary)
          // eslint-disable-next-line max-len
          // console.warn(`require called with un-prefixed module id: ${request}, should be a core or CommonJS module. Falling back to old Ti behavior and assuming it's an absolute path: /${request}`);

          loaded = this.loadAsFileOrDirectory(path.normalize(`/${request}`));
          if (loaded) {
            return loaded.exports;
          }
        }

        // 4. THROW "not found"
        throw new Error(`Requested module not found: ${request}`); // TODO Set 'code' property to 'MODULE_NOT_FOUND' to match Node?
      }

      /**
       * Loads the core module if it exists. If not, returns null.
       *
       * @param  {String}  id The request module id
       * @return {Object}    true if the module id matches a native or CommonJS module id, (or it's first path segment does).
       */
      loadCoreModule(id) {
        // skip bad ids, relative ids, absolute ids. "native"/"core" modules should be of form "module.id" or "module.id/sub.file.js"
        if (!id || id.startsWith('.') || id.startsWith('/')) {
          return null;
        }

        // check if we have a cached copy of the wrapper
        if (this.wrapperCache[id]) {
          return this.wrapperCache[id];
        }
        const parts = id.split('/');
        const externalBinding = kroll.externalBinding(parts[0]);
        if (externalBinding) {
          if (parts.length === 1) {
            // This is the "root" of an external module. It can look like:
            // request("com.example.mymodule")
            // We can load and return it right away (caching occurs in the called function).
            return this.loadExternalModule(parts[0], externalBinding);
          }

          // Could be a sub-module (CommonJS) of an external native module.
          // We allow that since TIMOB-9730.
          if (kroll.isExternalCommonJsModule(parts[0])) {
            const externalCommonJsContents = kroll.getExternalCommonJsModule(id);
            if (externalCommonJsContents) {
              // found it
              // FIXME Re-use loadAsJavaScriptText?
              const module = new Module(id, this);
              module.load(id, externalCommonJsContents);
              return module.exports;
            }
          }
        }
        return null; // failed to load
      }

      /**
       * Attempts to load a node module by id from the starting path
       * @param  {string} moduleId       The path of the module to load.
       * @param  {string[]} dirs       paths to search
       * @return {Module|null}      The module, if loaded. null if not.
       */
      loadNodeModules(moduleId, dirs) {
        // 2. for each DIR in DIRS:
        for (const dir of dirs) {
          // a. LOAD_AS_FILE(DIR/X)
          // b. LOAD_AS_DIRECTORY(DIR/X)
          const mod = this.loadAsFileOrDirectory(path.join(dir, moduleId));
          if (mod) {
            return mod;
          }
        }
        return null;
      }

      /**
       * Determine the set of paths to search for node_modules
       * @param  {string} startDir       The starting directory
       * @return {string[]}              The array of paths to search
       */
      nodeModulesPaths(startDir) {
        // Make sure we have an absolute path to start with
        startDir = path.resolve(startDir);

        // Return early if we are at root, this avoids doing a pointless loop
        // and also returning an array with duplicate entries
        // e.g. ["/node_modules", "/node_modules"]
        if (startDir === '/') {
          return ['/node_modules'];
        }
        // 1. let PARTS = path split(START)
        const parts = startDir.split('/');
        // 2. let I = count of PARTS - 1
        let i = parts.length - 1;
        // 3. let DIRS = []
        const dirs = [];

        // 4. while I >= 0,
        while (i >= 0) {
          // a. if PARTS[I] = "node_modules" CONTINUE
          if (parts[i] === 'node_modules' || parts[i] === '') {
            i -= 1;
            continue;
          }
          // b. DIR = path join(PARTS[0 .. I] + "node_modules")
          const dir = path.join(parts.slice(0, i + 1).join('/'), 'node_modules');
          // c. DIRS = DIRS + DIR
          dirs.push(dir);
          // d. let I = I - 1
          i -= 1;
        }
        // Always add /node_modules to the search path
        dirs.push('/node_modules');
        return dirs;
      }

      /**
       * Attempts to load a given path as a file or directory.
       * @param  {string} normalizedPath The path of the module to load.
       * @return {Module|null} The loaded module. null if unable to load.
       */
      loadAsFileOrDirectory(normalizedPath) {
        // a. LOAD_AS_FILE(Y + X)
        let loaded = this.loadAsFile(normalizedPath);
        if (loaded) {
          return loaded;
        }
        // b. LOAD_AS_DIRECTORY(Y + X)
        loaded = this.loadAsDirectory(normalizedPath);
        if (loaded) {
          return loaded;
        }
        return null;
      }

      /**
       * Loads a given file as a Javascript file, returning the module.exports.
       * @param  {string} filename File we're attempting to load
       * @return {Module} the loaded module
       */
      loadJavascriptText(filename) {
        // Look in the cache!
        if (Module.cache[filename]) {
          return Module.cache[filename];
        }
        const module = new Module(filename, this);
        module.load(filename);
        return module;
      }

      /**
       * Loads a JSON file by reading it's contents, doing a JSON.parse and returning the parsed object.
       *
       * @param  {String} filename File we're attempting to load
       * @return {Module} The loaded module instance
       */
      loadJavascriptObject(filename) {
        // Look in the cache!
        if (Module.cache[filename]) {
          return Module.cache[filename];
        }
        const module = new Module(filename, this);
        module.filename = filename;
        module.path = path.dirname(filename);
        const source = assets.readAsset(filename);

        // Stick it in the cache
        Module.cache[filename] = module;
        module.exports = JSON.parse(source);
        module.loaded = true;
        return module;
      }

      /**
       * Attempts to load a file by it's full filename according to NodeJS rules.
       *
       * @param  {string} id The filename
       * @return {Module|null} Module instance if loaded, null if not found.
       */
      loadAsFile(id) {
        // 1. If X is a file, load X as JavaScript text.  STOP
        let filename = id;
        if (this.filenameExists(filename)) {
          // If the file has a .json extension, load as JavascriptObject
          if (filename.length > 5 && filename.slice(-4) === 'json') {
            return this.loadJavascriptObject(filename);
          }
          return this.loadJavascriptText(filename);
        }
        // 2. If X.js is a file, load X.js as JavaScript text.  STOP
        filename = id + '.js';
        if (this.filenameExists(filename)) {
          return this.loadJavascriptText(filename);
        }
        // 3. If X.json is a file, parse X.json to a JavaScript Object.  STOP
        filename = id + '.json';
        if (this.filenameExists(filename)) {
          return this.loadJavascriptObject(filename);
        }
        // failed to load anything!
        return null;
      }

      /**
       * Attempts to load a directory according to NodeJS rules.
       *
       * @param  {string} id The directory name
       * @return {Module|null} Loaded module, null if not found.
       */
      loadAsDirectory(id) {
        // 1. If X/package.json is a file,
        let filename = path.resolve(id, 'package.json');
        if (this.filenameExists(filename)) {
          // a. Parse X/package.json, and look for "main" field.
          const object = this.loadJavascriptObject(filename);
          if (object && object.exports && object.exports.main) {
            // b. let M = X + (json main field)
            const m = path.resolve(id, object.exports.main);
            // c. LOAD_AS_FILE(M)
            return this.loadAsFileOrDirectory(m);
          }
        }

        // 2. If X/index.js is a file, load X/index.js as JavaScript text.  STOP
        filename = path.resolve(id, 'index.js');
        if (this.filenameExists(filename)) {
          return this.loadJavascriptText(filename);
        }
        // 3. If X/index.json is a file, parse X/index.json to a JavaScript object. STOP
        filename = path.resolve(id, 'index.json');
        if (this.filenameExists(filename)) {
          return this.loadJavascriptObject(filename);
        }
        return null;
      }

      /**
       * Setup a sandbox and run the module's script inside it.
       * Returns the result of the executed script.
       * @param  {String} source   [description]
       * @param  {String} filename [description]
       * @return {*}          [description]
       */
      _runScript(source, filename) {
        const self = this;
        function require(path) {
          return self.require(path);
        }
        require.main = Module.main;

        // This "first time" run is really only for app.js, AFAICT, and needs
        // an activity. If app was restarted for Service only, we don't want
        // to go this route. So added currentActivity check. (bill)
        if (self.id === '.' && !this.isService) {
          global.require = require;

          // check if we have an inspector binding...
          const inspector = kroll.binding('inspector');
          if (inspector) {
            // If debugger is enabled, load app.js and pause right before we execute it
            const inspectorWrapper = inspector.callAndPauseOnStart;
            if (inspectorWrapper) {
              // FIXME Why can't we do normal Module.wrap(source) here?
              // I get "Uncaught TypeError: Cannot read property 'createTabGroup' of undefined" for "Ti.UI.createTabGroup();"
              // Not sure why app.js is special case and can't be run under normal self-invoking wrapping function that gets passed in global/kroll/Ti/etc
              // Instead, let's use a slightly modified version of callAndPauseOnStart:
              // It will compile the source as-is, schedule a pause and then run the source.
              return inspectorWrapper(source, filename);
            }
          }
          // run app.js "normally" (i.e. not under debugger/inspector)
          return Script.runInThisContext(source, filename, true);
        }

        // In V8, we treat external modules the same as native modules.  First, we wrap the
        // module code and then run it in the current context.  This will allow external modules to
        // access globals as mentioned in TIMOB-11752. This will also help resolve startup slowness that
        // occurs as a result of creating a new context during startup in TIMOB-12286.
        source = Module.wrap(source);
        const f = Script.runInThisContext(source, filename, true);
        return f(this.exports, require, this, filename, path.dirname(filename), Titanium, Ti, global, kroll);
      }

      /**
       * Look up a filename in the app's index.json file
       * @param  {String} filename the file we're looking for
       * @return {Boolean}         true if the filename exists in the index.json
       */
      filenameExists(filename) {
        filename = 'Resources' + filename; // When we actually look for files, assume "Resources/" is the root
        if (!fileIndex) {
          const json = assets.readAsset(INDEX_JSON);
          fileIndex = JSON.parse(json);
        }
        return fileIndex && filename in fileIndex;
      }
    }
    Module.cache = [];
    Module.main = null;
    Module.wrapper = ['(function (exports, require, module, __filename, __dirname, Titanium, Ti, global, kroll) {', '\n});'];
    Module.wrap = function (script) {
      return Module.wrapper[0] + script + Module.wrapper[1];
    };

    /**
     * [runModule description]
     * @param  {String} source            JS Source code
     * @param  {String} filename          Filename of the module
     * @param  {Titanium.Service|null|Titanium.Android.Activity} activityOrService [description]
     * @return {Module}                   The loaded Module
     */
    Module.runModule = function (source, filename, activityOrService) {
      let id = filename;
      if (!Module.main) {
        id = '.';
      }
      const module = new Module(id, null);
      // FIXME: I don't know why instanceof for Titanium.Service works here!
      // On Android, it's an apiname of Ti.Android.Service
      // On iOS, we don't yet pass in the value, but we do set Ti.App.currentService property beforehand!
      // Can we remove the preload stuff in KrollBridge.m to pass along the service instance into this like we do on Andorid?
      module.isService = Ti.App.currentService !== null;
      if (!Module.main) {
        Module.main = module;
      }
      filename = filename.replace('Resources/', '/'); // normalize back to absolute paths (which really are relative to Resources under the hood)
      module.load(filename, source);
      return module;
    };
    return Module;
  }

  /* globals OS_ANDROID,OS_IOS */
  function bootstrap$1(global, kroll) {
    {
      // On iOS, really we just need to set up the TopTiModule binding stuff, then hang lazy property getters for the top-level modules like UI, API, etc
      const Ti = kroll.binding('topTi');
      const modules = ['Accelerometer', 'Analytics', 'App', 'API', 'Calendar', 'Codec', 'Contacts', 'Database', 'Filesystem', 'Geolocation', 'Gesture', 'Locale', 'Media', 'Network', 'Platform', 'Stream', 'Utils', 'UI', 'WatchSession', 'XML'];
      for (const modName of modules) {
        // This makes the namespace "lazy" - we instantiate it on demand and then
        // replace the lazy init with straight property value when done
        Object.defineProperty(Ti, modName, {
          configurable: true,
          // must be configurable to be able to change the property to static value after access
          enumerable: false,
          // writable: true, // cannot specify writable with a getter
          get: function () {
            const realModule = kroll.binding(modName);
            // Now replace our lazy getter on the property with a value
            Object.defineProperty(Ti, modName, {
              configurable: false,
              enumerable: false,
              writable: false,
              value: realModule
            });
            return realModule;
          }
        });
      }
      return Ti;
    }
  }

  // This is the file each platform loads on boot *before* we launch ti.main.js to insert all our shims/extensions

  /**
   * main bootstrapping function
   * @param {object} global the global object
   * @param {object} kroll; the kroll module/binding
   * @return {void}       [description]
   */
  function bootstrap(global, kroll) {
    // Works identical to Object.hasOwnProperty, except
    // also works if the given object does not have the method
    // on its prototype or it has been masked.
    function hasOwnProperty(object, property) {
      return Object.hasOwnProperty.call(object, property);
    }
    kroll.extend = function (thisObject, otherObject) {
      if (!otherObject) {
        // extend with what?!  denied!
        return;
      }
      for (var name in otherObject) {
        if (hasOwnProperty(otherObject, name)) {
          thisObject[name] = otherObject[name];
        }
      }
      return thisObject;
    };
    function startup() {
      global.global = global; // hang the global object off itself
      global.kroll = kroll; // hang our special under the hood kroll object off the global
      {
        // route kroll.externalBinding to same impl as binding - we treat 1st and 3rd party native modules the same
        kroll.externalBinding = kroll.binding;
      }
      global.Ti = global.Titanium = bootstrap$1(global, kroll);
      global.Module = bootstrap$2(global, kroll);
    }
    startup();
  }

  return bootstrap;

})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUFFc0MsS0FBSyxDQUFDO0lBQzVDO0lBQ0E0RixPQUFPLEVBQUU7RUFDWDs7RUFFQSxPQUFPTixTQUFTOztBQUVqQixDQUFDLEdBQUciLCJuYW1lcyI6WyJhc3NlcnRBcmd1bWVudFR5cGUiLCJhcmciLCJuYW1lIiwidHlwZW5hbWUiLCJ0eXBlIiwidG9Mb3dlckNhc2UiLCJUeXBlRXJyb3IiLCJGT1JXQVJEX1NMQVNIIiwiQkFDS1dBUkRfU0xBU0giLCJpc1dpbmRvd3NEZXZpY2VOYW1lIiwiY2hhckNvZGUiLCJpc0Fic29sdXRlIiwiaXNQb3NpeCIsImZpbGVwYXRoIiwibGVuZ3RoIiwiZmlyc3RDaGFyIiwiY2hhckNvZGVBdCIsImNoYXJBdCIsInRoaXJkQ2hhciIsImRpcm5hbWUiLCJzZXBhcmF0b3IiLCJmcm9tSW5kZXgiLCJoYWRUcmFpbGluZyIsImVuZHNXaXRoIiwiZm91bmRJbmRleCIsImxhc3RJbmRleE9mIiwic2xpY2UiLCJleHRuYW1lIiwiaW5kZXgiLCJlbmRJbmRleCIsImxhc3RJbmRleFdpbjMyU2VwYXJhdG9yIiwiaSIsImNoYXIiLCJiYXNlbmFtZSIsImV4dCIsInVuZGVmaW5lZCIsImxhc3RDaGFyQ29kZSIsImxhc3RJbmRleCIsImJhc2UiLCJub3JtYWxpemUiLCJpc1dpbmRvd3MiLCJyZXBsYWNlIiwiaGFkTGVhZGluZyIsInN0YXJ0c1dpdGgiLCJpc1VOQyIsInBhcnRzIiwic3BsaXQiLCJyZXN1bHQiLCJzZWdtZW50IiwicG9wIiwicHVzaCIsIm5vcm1hbGl6ZWQiLCJqb2luIiwiYXNzZXJ0U2VnbWVudCIsInBhdGhzIiwicmVzb2x2ZSIsInJlc29sdmVkIiwiaGl0Um9vdCIsImdsb2JhbCIsInByb2Nlc3MiLCJjd2QiLCJyZWxhdGl2ZSIsImZyb20iLCJ0byIsInVwQ291bnQiLCJyZW1haW5pbmdQYXRoIiwicmVwZWF0IiwicGFyc2UiLCJyb290IiwiZGlyIiwiYmFzZUxlbmd0aCIsInRvU3VidHJhY3QiLCJmaXJzdENoYXJDb2RlIiwidGhpcmRDaGFyQ29kZSIsImZvcm1hdCIsInBhdGhPYmplY3QiLCJ0b05hbWVzcGFjZWRQYXRoIiwicmVzb2x2ZWRQYXRoIiwiV2luMzJQYXRoIiwic2VwIiwiZGVsaW1pdGVyIiwiX2xlbiIsImFyZ3VtZW50cyIsIkFycmF5IiwiX2tleSIsIl9sZW4yIiwiX2tleTIiLCJQb3NpeFBhdGgiLCJfbGVuMyIsIl9rZXkzIiwiX2xlbjQiLCJfa2V5NCIsInBhdGgiLCJ3aW4zMiIsInBvc2l4IiwiYm9vdHN0cmFwJDIiLCJrcm9sbCIsImFzc2V0cyIsImJpbmRpbmciLCJTY3JpcHQiLCJmaWxlSW5kZXgiLCJJTkRFWF9KU09OIiwiTW9kdWxlIiwiY29uc3RydWN0b3IiLCJpZCIsInBhcmVudCIsImV4cG9ydHMiLCJmaWxlbmFtZSIsImxvYWRlZCIsIndyYXBwZXJDYWNoZSIsImlzU2VydmljZSIsImxvYWQiLCJzb3VyY2UiLCJFcnJvciIsIm5vZGVNb2R1bGVzUGF0aHMiLCJyZWFkQXNzZXQiLCJjYWNoZSIsIl9ydW5TY3JpcHQiLCJjcmVhdGVNb2R1bGVXcmFwcGVyIiwiZXh0ZXJuYWxNb2R1bGUiLCJzb3VyY2VVcmwiLCJleHRlbmRNb2R1bGVXaXRoQ29tbW9uSnMiLCJpc0V4dGVybmFsQ29tbW9uSnNNb2R1bGUiLCJmYWtlSWQiLCJqc01vZHVsZSIsImdldEV4dGVybmFsQ29tbW9uSnNNb2R1bGUiLCJjb25zb2xlIiwidHJhY2UiLCJleHRlbmQiLCJsb2FkRXh0ZXJuYWxNb2R1bGUiLCJleHRlcm5hbEJpbmRpbmciLCJ3cmFwcGVyIiwicmVxdWlyZSIsInJlcXVlc3QiLCJzdGFydCIsInN1YnN0cmluZyIsImxvYWRBc0ZpbGVPckRpcmVjdG9yeSIsImxvYWRDb3JlTW9kdWxlIiwiaW5kZXhPZiIsImZpbGVuYW1lRXhpc3RzIiwibG9hZEphdmFzY3JpcHRUZXh0IiwibG9hZEFzRGlyZWN0b3J5IiwibG9hZE5vZGVNb2R1bGVzIiwiZXh0ZXJuYWxDb21tb25Kc0NvbnRlbnRzIiwibW9kdWxlIiwibW9kdWxlSWQiLCJkaXJzIiwibW9kIiwic3RhcnREaXIiLCJub3JtYWxpemVkUGF0aCIsImxvYWRBc0ZpbGUiLCJsb2FkSmF2YXNjcmlwdE9iamVjdCIsIkpTT04iLCJvYmplY3QiLCJtYWluIiwibSIsInNlbGYiLCJpbnNwZWN0b3IiLCJpbnNwZWN0b3JXcmFwcGVyIiwiY2FsbEFuZFBhdXNlT25TdGFydCIsInJ1bkluVGhpc0NvbnRleHQiLCJ3cmFwIiwiZiIsIlRpdGFuaXVtIiwiVGkiLCJqc29uIiwic2NyaXB0IiwicnVuTW9kdWxlIiwiYWN0aXZpdHlPclNlcnZpY2UiLCJBcHAiLCJjdXJyZW50U2VydmljZSIsImJvb3RzdHJhcCQxIiwibW9kdWxlcyIsIm1vZE5hbWUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImNvbmZpZ3VyYWJsZSIsImVudW1lcmFibGUiLCJnZXQiLCJyZWFsTW9kdWxlIiwid3JpdGFibGUiLCJ2YWx1ZSIsImJvb3RzdHJhcCIsImhhc093blByb3BlcnR5IiwicHJvcGVydHkiLCJjYWxsIiwidGhpc09iamVjdCIsIm90aGVyT2JqZWN0Iiwic3RhcnR1cCJdLCJzb3VyY2VSb290IjoiL1VzZXJzL2FkaXRpc3VyeWF3YW5zaGkvTGlicmFyeS9BcHBsaWNhdGlvbiBTdXBwb3J0L1RpdGFuaXVtL21vYmlsZXNkay9vc3gvMTIuNy4xLkdBL2NvbW1vbi9SZXNvdXJjZXMvaW9zIiwic291cmNlcyI6WyJ0aS5rZXJuZWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uICgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0gIHsqfSBhcmcgcGFzc2VkIGluIGFyZ3VtZW50IHZhbHVlXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gbmFtZSBuYW1lIG9mIHRoZSBhcmd1bWVudFxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHR5cGVuYW1lIGkuZS4gJ3N0cmluZycsICdGdW5jdGlvbicgKHZhbHVlIGlzIGNvbXBhcmVkIHRvIHR5cGVvZiBhZnRlciBsb3dlcmNhc2luZylcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICogQHRocm93cyB7VHlwZUVycm9yfVxuXHQgKi9cblx0ZnVuY3Rpb24gYXNzZXJ0QXJndW1lbnRUeXBlKGFyZywgbmFtZSwgdHlwZW5hbWUpIHtcblx0ICBjb25zdCB0eXBlID0gdHlwZW9mIGFyZztcblx0ICBpZiAodHlwZSAhPT0gdHlwZW5hbWUudG9Mb3dlckNhc2UoKSkge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVGhlIFwiJHtuYW1lfVwiIGFyZ3VtZW50IG11c3QgYmUgb2YgdHlwZSAke3R5cGVuYW1lfS4gUmVjZWl2ZWQgdHlwZSAke3R5cGV9YCk7XG5cdCAgfVxuXHR9XG5cblx0Y29uc3QgRk9SV0FSRF9TTEFTSCA9IDQ3OyAvLyAnLydcblx0Y29uc3QgQkFDS1dBUkRfU0xBU0ggPSA5MjsgLy8gJ1xcXFwnXG5cblx0LyoqXG5cdCAqIElzIHRoaXMgW2EtekEtWl0/XG5cdCAqIEBwYXJhbSAge251bWJlcn0gIGNoYXJDb2RlIHZhbHVlIGZyb20gU3RyaW5nLmNoYXJDb2RlQXQoKVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRmdW5jdGlvbiBpc1dpbmRvd3NEZXZpY2VOYW1lKGNoYXJDb2RlKSB7XG5cdCAgcmV0dXJuIGNoYXJDb2RlID49IDY1ICYmIGNoYXJDb2RlIDw9IDkwIHx8IGNoYXJDb2RlID49IDk3ICYmIGNoYXJDb2RlIDw9IDEyMjtcblx0fVxuXG5cdC8qKlxuXHQgKiBbaXNBYnNvbHV0ZSBkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7Ym9vbGVhbn0gaXNQb3NpeCB3aGV0aGVyIHRoaXMgaW1wbCBpcyBmb3IgUE9TSVggb3Igbm90XG5cdCAqIEBwYXJhbSAge3N0cmluZ30gZmlsZXBhdGggICBpbnB1dCBmaWxlIHBhdGhcblx0ICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0ZnVuY3Rpb24gaXNBYnNvbHV0ZShpc1Bvc2l4LCBmaWxlcGF0aCkge1xuXHQgIGFzc2VydEFyZ3VtZW50VHlwZShmaWxlcGF0aCwgJ3BhdGgnLCAnc3RyaW5nJyk7XG5cdCAgY29uc3QgbGVuZ3RoID0gZmlsZXBhdGgubGVuZ3RoO1xuXHQgIC8vIGVtcHR5IHN0cmluZyBzcGVjaWFsIGNhc2Vcblx0ICBpZiAobGVuZ3RoID09PSAwKSB7XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXHQgIGNvbnN0IGZpcnN0Q2hhciA9IGZpbGVwYXRoLmNoYXJDb2RlQXQoMCk7XG5cdCAgaWYgKGZpcnN0Q2hhciA9PT0gRk9SV0FSRF9TTEFTSCkge1xuXHQgICAgcmV0dXJuIHRydWU7XG5cdCAgfVxuXHQgIC8vIHdlIGFscmVhZHkgZGlkIG91ciBjaGVja3MgZm9yIHBvc2l4XG5cdCAgaWYgKGlzUG9zaXgpIHtcblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cdCAgLy8gd2luMzIgZnJvbSBoZXJlIG9uIG91dFxuXHQgIGlmIChmaXJzdENoYXIgPT09IEJBQ0tXQVJEX1NMQVNIKSB7XG5cdCAgICByZXR1cm4gdHJ1ZTtcblx0ICB9XG5cdCAgaWYgKGxlbmd0aCA+IDIgJiYgaXNXaW5kb3dzRGV2aWNlTmFtZShmaXJzdENoYXIpICYmIGZpbGVwYXRoLmNoYXJBdCgxKSA9PT0gJzonKSB7XG5cdCAgICBjb25zdCB0aGlyZENoYXIgPSBmaWxlcGF0aC5jaGFyQXQoMik7XG5cdCAgICByZXR1cm4gdGhpcmRDaGFyID09PSAnLycgfHwgdGhpcmRDaGFyID09PSAnXFxcXCc7XG5cdCAgfVxuXHQgIHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBbZGlybmFtZSBkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7c3RyaW5nfSBzZXBhcmF0b3IgIHBsYXRmb3JtLXNwZWNpZmljIGZpbGUgc2VwYXJhdG9yXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gZmlsZXBhdGggICBpbnB1dCBmaWxlIHBhdGhcblx0ICogQHJldHVybiB7c3RyaW5nfSAgICAgICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGZ1bmN0aW9uIGRpcm5hbWUoc2VwYXJhdG9yLCBmaWxlcGF0aCkge1xuXHQgIGFzc2VydEFyZ3VtZW50VHlwZShmaWxlcGF0aCwgJ3BhdGgnLCAnc3RyaW5nJyk7XG5cdCAgY29uc3QgbGVuZ3RoID0gZmlsZXBhdGgubGVuZ3RoO1xuXHQgIGlmIChsZW5ndGggPT09IDApIHtcblx0ICAgIHJldHVybiAnLic7XG5cdCAgfVxuXG5cdCAgLy8gaWdub3JlIHRyYWlsaW5nIHNlcGFyYXRvclxuXHQgIGxldCBmcm9tSW5kZXggPSBsZW5ndGggLSAxO1xuXHQgIGNvbnN0IGhhZFRyYWlsaW5nID0gZmlsZXBhdGguZW5kc1dpdGgoc2VwYXJhdG9yKTtcblx0ICBpZiAoaGFkVHJhaWxpbmcpIHtcblx0ICAgIGZyb21JbmRleC0tO1xuXHQgIH1cblx0ICBjb25zdCBmb3VuZEluZGV4ID0gZmlsZXBhdGgubGFzdEluZGV4T2Yoc2VwYXJhdG9yLCBmcm9tSW5kZXgpO1xuXHQgIC8vIG5vIHNlcGFyYXRvcnNcblx0ICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIHtcblx0ICAgIC8vIGhhbmRsZSBzcGVjaWFsIGNhc2Ugb2Ygcm9vdCB3aW5kb3dzIHBhdGhzXG5cdCAgICBpZiAobGVuZ3RoID49IDIgJiYgc2VwYXJhdG9yID09PSAnXFxcXCcgJiYgZmlsZXBhdGguY2hhckF0KDEpID09PSAnOicpIHtcblx0ICAgICAgY29uc3QgZmlyc3RDaGFyID0gZmlsZXBhdGguY2hhckNvZGVBdCgwKTtcblx0ICAgICAgaWYgKGlzV2luZG93c0RldmljZU5hbWUoZmlyc3RDaGFyKSkge1xuXHQgICAgICAgIHJldHVybiBmaWxlcGF0aDsgLy8gaXQncyBhIHJvb3Qgd2luZG93cyBwYXRoXG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuICcuJztcblx0ICB9XG5cdCAgLy8gb25seSBmb3VuZCByb290IHNlcGFyYXRvclxuXHQgIGlmIChmb3VuZEluZGV4ID09PSAwKSB7XG5cdCAgICByZXR1cm4gc2VwYXJhdG9yOyAvLyBpZiBpdCB3YXMgJy8nLCByZXR1cm4gdGhhdFxuXHQgIH1cblx0ICAvLyBIYW5kbGUgc3BlY2lhbCBjYXNlIG9mICcvL3NvbWV0aGluZydcblx0ICBpZiAoZm91bmRJbmRleCA9PT0gMSAmJiBzZXBhcmF0b3IgPT09ICcvJyAmJiBmaWxlcGF0aC5jaGFyQXQoMCkgPT09ICcvJykge1xuXHQgICAgcmV0dXJuICcvLyc7XG5cdCAgfVxuXHQgIHJldHVybiBmaWxlcGF0aC5zbGljZSgwLCBmb3VuZEluZGV4KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBbZXh0bmFtZSBkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7c3RyaW5nfSBzZXBhcmF0b3IgIHBsYXRmb3JtLXNwZWNpZmljIGZpbGUgc2VwYXJhdG9yXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gZmlsZXBhdGggICBpbnB1dCBmaWxlIHBhdGhcblx0ICogQHJldHVybiB7c3RyaW5nfSAgICAgICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGZ1bmN0aW9uIGV4dG5hbWUoc2VwYXJhdG9yLCBmaWxlcGF0aCkge1xuXHQgIGFzc2VydEFyZ3VtZW50VHlwZShmaWxlcGF0aCwgJ3BhdGgnLCAnc3RyaW5nJyk7XG5cdCAgY29uc3QgaW5kZXggPSBmaWxlcGF0aC5sYXN0SW5kZXhPZignLicpO1xuXHQgIGlmIChpbmRleCA9PT0gLTEgfHwgaW5kZXggPT09IDApIHtcblx0ICAgIHJldHVybiAnJztcblx0ICB9XG5cdCAgLy8gaWdub3JlIHRyYWlsaW5nIHNlcGFyYXRvclxuXHQgIGxldCBlbmRJbmRleCA9IGZpbGVwYXRoLmxlbmd0aDtcblx0ICBpZiAoZmlsZXBhdGguZW5kc1dpdGgoc2VwYXJhdG9yKSkge1xuXHQgICAgZW5kSW5kZXgtLTtcblx0ICB9XG5cdCAgcmV0dXJuIGZpbGVwYXRoLnNsaWNlKGluZGV4LCBlbmRJbmRleCk7XG5cdH1cblx0ZnVuY3Rpb24gbGFzdEluZGV4V2luMzJTZXBhcmF0b3IoZmlsZXBhdGgsIGluZGV4KSB7XG5cdCAgZm9yIChsZXQgaSA9IGluZGV4OyBpID49IDA7IGktLSkge1xuXHQgICAgY29uc3QgY2hhciA9IGZpbGVwYXRoLmNoYXJDb2RlQXQoaSk7XG5cdCAgICBpZiAoY2hhciA9PT0gQkFDS1dBUkRfU0xBU0ggfHwgY2hhciA9PT0gRk9SV0FSRF9TTEFTSCkge1xuXHQgICAgICByZXR1cm4gaTtcblx0ICAgIH1cblx0ICB9XG5cdCAgcmV0dXJuIC0xO1xuXHR9XG5cblx0LyoqXG5cdCAqIFtiYXNlbmFtZSBkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7c3RyaW5nfSBzZXBhcmF0b3IgIHBsYXRmb3JtLXNwZWNpZmljIGZpbGUgc2VwYXJhdG9yXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gZmlsZXBhdGggICBpbnB1dCBmaWxlIHBhdGhcblx0ICogQHBhcmFtICB7c3RyaW5nfSBbZXh0XSAgICAgIGZpbGUgZXh0ZW5zaW9uIHRvIGRyb3AgaWYgaXQgZXhpc3RzXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gICAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRmdW5jdGlvbiBiYXNlbmFtZShzZXBhcmF0b3IsIGZpbGVwYXRoLCBleHQpIHtcblx0ICBhc3NlcnRBcmd1bWVudFR5cGUoZmlsZXBhdGgsICdwYXRoJywgJ3N0cmluZycpO1xuXHQgIGlmIChleHQgIT09IHVuZGVmaW5lZCkge1xuXHQgICAgYXNzZXJ0QXJndW1lbnRUeXBlKGV4dCwgJ2V4dCcsICdzdHJpbmcnKTtcblx0ICB9XG5cdCAgY29uc3QgbGVuZ3RoID0gZmlsZXBhdGgubGVuZ3RoO1xuXHQgIGlmIChsZW5ndGggPT09IDApIHtcblx0ICAgIHJldHVybiAnJztcblx0ICB9XG5cdCAgY29uc3QgaXNQb3NpeCA9IHNlcGFyYXRvciA9PT0gJy8nO1xuXHQgIGxldCBlbmRJbmRleCA9IGxlbmd0aDtcblx0ICAvLyBkcm9wIHRyYWlsaW5nIHNlcGFyYXRvciAoaWYgdGhlcmUgaXMgb25lKVxuXHQgIGNvbnN0IGxhc3RDaGFyQ29kZSA9IGZpbGVwYXRoLmNoYXJDb2RlQXQobGVuZ3RoIC0gMSk7XG5cdCAgaWYgKGxhc3RDaGFyQ29kZSA9PT0gRk9SV0FSRF9TTEFTSCB8fCAhaXNQb3NpeCAmJiBsYXN0Q2hhckNvZGUgPT09IEJBQ0tXQVJEX1NMQVNIKSB7XG5cdCAgICBlbmRJbmRleC0tO1xuXHQgIH1cblxuXHQgIC8vIEZpbmQgbGFzdCBvY2N1cmVuY2Ugb2Ygc2VwYXJhdG9yXG5cdCAgbGV0IGxhc3RJbmRleCA9IC0xO1xuXHQgIGlmIChpc1Bvc2l4KSB7XG5cdCAgICBsYXN0SW5kZXggPSBmaWxlcGF0aC5sYXN0SW5kZXhPZihzZXBhcmF0b3IsIGVuZEluZGV4IC0gMSk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIC8vIE9uIHdpbjMyLCBoYW5kbGUgKmVpdGhlciogc2VwYXJhdG9yIVxuXHQgICAgbGFzdEluZGV4ID0gbGFzdEluZGV4V2luMzJTZXBhcmF0b3IoZmlsZXBhdGgsIGVuZEluZGV4IC0gMSk7XG5cdCAgICAvLyBoYW5kbGUgc3BlY2lhbCBjYXNlIG9mIHJvb3QgcGF0aCBsaWtlICdDOicgb3IgJ0M6XFxcXCdcblx0ICAgIGlmICgobGFzdEluZGV4ID09PSAyIHx8IGxhc3RJbmRleCA9PT0gLTEpICYmIGZpbGVwYXRoLmNoYXJBdCgxKSA9PT0gJzonICYmIGlzV2luZG93c0RldmljZU5hbWUoZmlsZXBhdGguY2hhckNvZGVBdCgwKSkpIHtcblx0ICAgICAgcmV0dXJuICcnO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8vIFRha2UgZnJvbSBsYXN0IG9jY3VycmVuY2Ugb2Ygc2VwYXJhdG9yIHRvIGVuZCBvZiBzdHJpbmcgKG9yIGJlZ2lubmluZyB0byBlbmQgaWYgbm90IGZvdW5kKVxuXHQgIGNvbnN0IGJhc2UgPSBmaWxlcGF0aC5zbGljZShsYXN0SW5kZXggKyAxLCBlbmRJbmRleCk7XG5cblx0ICAvLyBkcm9wIHRyYWlsaW5nIGV4dGVuc2lvbiAoaWYgc3BlY2lmaWVkKVxuXHQgIGlmIChleHQgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgcmV0dXJuIGJhc2U7XG5cdCAgfVxuXHQgIHJldHVybiBiYXNlLmVuZHNXaXRoKGV4dCkgPyBiYXNlLnNsaWNlKDAsIGJhc2UubGVuZ3RoIC0gZXh0Lmxlbmd0aCkgOiBiYXNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBgcGF0aC5ub3JtYWxpemUoKWAgbWV0aG9kIG5vcm1hbGl6ZXMgdGhlIGdpdmVuIHBhdGgsIHJlc29sdmluZyAnLi4nIGFuZCAnLicgc2VnbWVudHMuXG5cdCAqXG5cdCAqIFdoZW4gbXVsdGlwbGUsIHNlcXVlbnRpYWwgcGF0aCBzZWdtZW50IHNlcGFyYXRpb24gY2hhcmFjdGVycyBhcmUgZm91bmQgKGUuZy5cblx0ICogLyBvbiBQT1NJWCBhbmQgZWl0aGVyIFxcIG9yIC8gb24gV2luZG93cyksIHRoZXkgYXJlIHJlcGxhY2VkIGJ5IGEgc2luZ2xlXG5cdCAqIGluc3RhbmNlIG9mIHRoZSBwbGF0Zm9ybS1zcGVjaWZpYyBwYXRoIHNlZ21lbnQgc2VwYXJhdG9yICgvIG9uIFBPU0lYIGFuZCBcXFxuXHQgKiBvbiBXaW5kb3dzKS4gVHJhaWxpbmcgc2VwYXJhdG9ycyBhcmUgcHJlc2VydmVkLlxuXHQgKlxuXHQgKiBJZiB0aGUgcGF0aCBpcyBhIHplcm8tbGVuZ3RoIHN0cmluZywgJy4nIGlzIHJldHVybmVkLCByZXByZXNlbnRpbmcgdGhlXG5cdCAqIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkuXG5cdCAqXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gc2VwYXJhdG9yICBwbGF0Zm9ybS1zcGVjaWZpYyBmaWxlIHNlcGFyYXRvclxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IGZpbGVwYXRoICBpbnB1dCBmaWxlIHBhdGhcblx0ICogQHJldHVybiB7c3RyaW5nfSBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemUoc2VwYXJhdG9yLCBmaWxlcGF0aCkge1xuXHQgIGFzc2VydEFyZ3VtZW50VHlwZShmaWxlcGF0aCwgJ3BhdGgnLCAnc3RyaW5nJyk7XG5cdCAgaWYgKGZpbGVwYXRoLmxlbmd0aCA9PT0gMCkge1xuXHQgICAgcmV0dXJuICcuJztcblx0ICB9XG5cblx0ICAvLyBXaW5kb3dzIGNhbiBoYW5kbGUgJy8nIG9yICdcXFxcJyBhbmQgYm90aCBzaG91bGQgYmUgdHVybmVkIGludG8gc2VwYXJhdG9yXG5cdCAgY29uc3QgaXNXaW5kb3dzID0gc2VwYXJhdG9yID09PSAnXFxcXCc7XG5cdCAgaWYgKGlzV2luZG93cykge1xuXHQgICAgZmlsZXBhdGggPSBmaWxlcGF0aC5yZXBsYWNlKC9cXC8vZywgc2VwYXJhdG9yKTtcblx0ICB9XG5cdCAgY29uc3QgaGFkTGVhZGluZyA9IGZpbGVwYXRoLnN0YXJ0c1dpdGgoc2VwYXJhdG9yKTtcblx0ICAvLyBPbiBXaW5kb3dzLCBuZWVkIHRvIGhhbmRsZSBVTkMgcGF0aHMgKFxcXFxob3N0LW5hbWVcXFxccmVzb3VyY2VcXFxcZGlyKSBzcGVjaWFsIHRvIHJldGFpbiBsZWFkaW5nIGRvdWJsZSBiYWNrc2xhc2hcblx0ICBjb25zdCBpc1VOQyA9IGhhZExlYWRpbmcgJiYgaXNXaW5kb3dzICYmIGZpbGVwYXRoLmxlbmd0aCA+IDIgJiYgZmlsZXBhdGguY2hhckF0KDEpID09PSAnXFxcXCc7XG5cdCAgY29uc3QgaGFkVHJhaWxpbmcgPSBmaWxlcGF0aC5lbmRzV2l0aChzZXBhcmF0b3IpO1xuXHQgIGNvbnN0IHBhcnRzID0gZmlsZXBhdGguc3BsaXQoc2VwYXJhdG9yKTtcblx0ICBjb25zdCByZXN1bHQgPSBbXTtcblx0ICBmb3IgKGNvbnN0IHNlZ21lbnQgb2YgcGFydHMpIHtcblx0ICAgIGlmIChzZWdtZW50Lmxlbmd0aCAhPT0gMCAmJiBzZWdtZW50ICE9PSAnLicpIHtcblx0ICAgICAgaWYgKHNlZ21lbnQgPT09ICcuLicpIHtcblx0ICAgICAgICByZXN1bHQucG9wKCk7IC8vIEZJWE1FOiBXaGF0IGlmIHRoaXMgZ29lcyBhYm92ZSByb290PyBTaG91bGQgd2UgdGhyb3cgYW4gZXJyb3I/XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmVzdWx0LnB1c2goc2VnbWVudCk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9XG5cdCAgbGV0IG5vcm1hbGl6ZWQgPSBoYWRMZWFkaW5nID8gc2VwYXJhdG9yIDogJyc7XG5cdCAgbm9ybWFsaXplZCArPSByZXN1bHQuam9pbihzZXBhcmF0b3IpO1xuXHQgIGlmIChoYWRUcmFpbGluZykge1xuXHQgICAgbm9ybWFsaXplZCArPSBzZXBhcmF0b3I7XG5cdCAgfVxuXHQgIGlmIChpc1VOQykge1xuXHQgICAgbm9ybWFsaXplZCA9ICdcXFxcJyArIG5vcm1hbGl6ZWQ7XG5cdCAgfVxuXHQgIHJldHVybiBub3JtYWxpemVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFthc3NlcnRTZWdtZW50IGRlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHsqfSBzZWdtZW50IFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7dm9pZH0gICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRmdW5jdGlvbiBhc3NlcnRTZWdtZW50KHNlZ21lbnQpIHtcblx0ICBpZiAodHlwZW9mIHNlZ21lbnQgIT09ICdzdHJpbmcnKSB7XG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXRoIG11c3QgYmUgYSBzdHJpbmcuIFJlY2VpdmVkICR7c2VnbWVudH1gKTtcblx0ICB9XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwYXRoLmpvaW4oKWAgbWV0aG9kIGpvaW5zIGFsbCBnaXZlbiBwYXRoIHNlZ21lbnRzIHRvZ2V0aGVyIHVzaW5nIHRoZVxuXHQgKiBwbGF0Zm9ybS1zcGVjaWZpYyBzZXBhcmF0b3IgYXMgYSBkZWxpbWl0ZXIsIHRoZW4gbm9ybWFsaXplcyB0aGUgcmVzdWx0aW5nIHBhdGguXG5cdCAqIFplcm8tbGVuZ3RoIHBhdGggc2VnbWVudHMgYXJlIGlnbm9yZWQuIElmIHRoZSBqb2luZWQgcGF0aCBzdHJpbmcgaXMgYSB6ZXJvLVxuXHQgKiBsZW5ndGggc3RyaW5nIHRoZW4gJy4nIHdpbGwgYmUgcmV0dXJuZWQsIHJlcHJlc2VudGluZyB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeS5cblx0ICogQHBhcmFtICB7c3RyaW5nfSBzZXBhcmF0b3IgcGxhdGZvcm0tc3BlY2lmaWMgZmlsZSBzZXBhcmF0b3Jcblx0ICogQHBhcmFtICB7c3RyaW5nW119IHBhdGhzIFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7c3RyaW5nfSAgICAgICBUaGUgam9pbmVkIGZpbGVwYXRoXG5cdCAqL1xuXHRmdW5jdGlvbiBqb2luKHNlcGFyYXRvciwgcGF0aHMpIHtcblx0ICBjb25zdCByZXN1bHQgPSBbXTtcblx0ICAvLyBuYWl2ZSBpbXBsOiBqdXN0IGpvaW4gYWxsIHRoZSBwYXRocyB3aXRoIHNlcGFyYXRvclxuXHQgIGZvciAoY29uc3Qgc2VnbWVudCBvZiBwYXRocykge1xuXHQgICAgYXNzZXJ0U2VnbWVudChzZWdtZW50KTtcblx0ICAgIGlmIChzZWdtZW50Lmxlbmd0aCAhPT0gMCkge1xuXHQgICAgICByZXN1bHQucHVzaChzZWdtZW50KTtcblx0ICAgIH1cblx0ICB9XG5cdCAgcmV0dXJuIG5vcm1hbGl6ZShzZXBhcmF0b3IsIHJlc3VsdC5qb2luKHNlcGFyYXRvcikpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBgcGF0aC5yZXNvbHZlKClgIG1ldGhvZCByZXNvbHZlcyBhIHNlcXVlbmNlIG9mIHBhdGhzIG9yIHBhdGggc2VnbWVudHMgaW50byBhbiBhYnNvbHV0ZSBwYXRoLlxuXHQgKlxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHNlcGFyYXRvciBwbGF0Zm9ybS1zcGVjaWZpYyBmaWxlIHNlcGFyYXRvclxuXHQgKiBAcGFyYW0gIHtzdHJpbmdbXX0gcGF0aHMgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9ICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGZ1bmN0aW9uIHJlc29sdmUoc2VwYXJhdG9yLCBwYXRocykge1xuXHQgIGxldCByZXNvbHZlZCA9ICcnO1xuXHQgIGxldCBoaXRSb290ID0gZmFsc2U7XG5cdCAgY29uc3QgaXNQb3NpeCA9IHNlcGFyYXRvciA9PT0gJy8nO1xuXHQgIC8vIGdvIGZyb20gcmlnaHQgdG8gbGVmdCB1bnRpbCB3ZSBoaXQgYWJzb2x1dGUgcGF0aC9yb290XG5cdCAgZm9yIChsZXQgaSA9IHBhdGhzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdCAgICBjb25zdCBzZWdtZW50ID0gcGF0aHNbaV07XG5cdCAgICBhc3NlcnRTZWdtZW50KHNlZ21lbnQpO1xuXHQgICAgaWYgKHNlZ21lbnQubGVuZ3RoID09PSAwKSB7XG5cdCAgICAgIGNvbnRpbnVlOyAvLyBza2lwIGVtcHR5XG5cdCAgICB9XG5cblx0ICAgIHJlc29sdmVkID0gc2VnbWVudCArIHNlcGFyYXRvciArIHJlc29sdmVkOyAvLyBwcmVwZW5kIG5ldyBzZWdtZW50XG5cdCAgICBpZiAoaXNBYnNvbHV0ZShpc1Bvc2l4LCBzZWdtZW50KSkge1xuXHQgICAgICAvLyBoYXZlIHdlIGJhY2tlZCBpbnRvIGFuIGFic29sdXRlIHBhdGg/XG5cdCAgICAgIGhpdFJvb3QgPSB0cnVlO1xuXHQgICAgICBicmVhaztcblx0ICAgIH1cblx0ICB9XG5cdCAgLy8gaWYgd2UgZGlkbid0IGhpdCByb290LCBwcmVwZW5kIGN3ZFxuXHQgIGlmICghaGl0Um9vdCkge1xuXHQgICAgcmVzb2x2ZWQgPSAoZ2xvYmFsLnByb2Nlc3MgPyBwcm9jZXNzLmN3ZCgpIDogJy8nKSArIHNlcGFyYXRvciArIHJlc29sdmVkO1xuXHQgIH1cblx0ICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplKHNlcGFyYXRvciwgcmVzb2x2ZWQpO1xuXHQgIGlmIChub3JtYWxpemVkLmNoYXJBdChub3JtYWxpemVkLmxlbmd0aCAtIDEpID09PSBzZXBhcmF0b3IpIHtcblx0ICAgIC8vIEZJWE1FOiBIYW5kbGUgVU5DIHBhdGhzIG9uIFdpbmRvd3MgYXMgd2VsbCwgc28gd2UgZG9uJ3QgdHJpbSB0cmFpbGluZyBzZXBhcmF0b3Igb24gc29tZXRoaW5nIGxpa2UgJ1xcXFxcXFxcaG9zdC1uYW1lXFxcXHJlc291cmNlXFxcXCdcblx0ICAgIC8vIERvbid0IHJlbW92ZSB0cmFpbGluZyBzZXBhcmF0b3IgaWYgdGhpcyBpcyByb290IHBhdGggb24gd2luZG93cyFcblx0ICAgIGlmICghaXNQb3NpeCAmJiBub3JtYWxpemVkLmxlbmd0aCA9PT0gMyAmJiBub3JtYWxpemVkLmNoYXJBdCgxKSA9PT0gJzonICYmIGlzV2luZG93c0RldmljZU5hbWUobm9ybWFsaXplZC5jaGFyQ29kZUF0KDApKSkge1xuXHQgICAgICByZXR1cm4gbm9ybWFsaXplZDtcblx0ICAgIH1cblx0ICAgIC8vIG90aGVyd2lzZSB0cmltIHRyYWlsaW5nIHNlcGFyYXRvclxuXHQgICAgcmV0dXJuIG5vcm1hbGl6ZWQuc2xpY2UoMCwgbm9ybWFsaXplZC5sZW5ndGggLSAxKTtcblx0ICB9XG5cdCAgcmV0dXJuIG5vcm1hbGl6ZWQ7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwYXRoLnJlbGF0aXZlKClgIG1ldGhvZCByZXR1cm5zIHRoZSByZWxhdGl2ZSBwYXRoIGBmcm9tYCBmcm9tIHRvIGB0b2AgYmFzZWRcblx0ICogb24gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkuIElmIGZyb20gYW5kIHRvIGVhY2ggcmVzb2x2ZSB0byB0aGUgc2FtZVxuXHQgKiBwYXRoIChhZnRlciBjYWxsaW5nIGBwYXRoLnJlc29sdmUoKWAgb24gZWFjaCksIGEgemVyby1sZW5ndGggc3RyaW5nIGlzIHJldHVybmVkLlxuXHQgKlxuXHQgKiBJZiBhIHplcm8tbGVuZ3RoIHN0cmluZyBpcyBwYXNzZWQgYXMgYGZyb21gIG9yIGB0b2AsIHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XG5cdCAqIHdpbGwgYmUgdXNlZCBpbnN0ZWFkIG9mIHRoZSB6ZXJvLWxlbmd0aCBzdHJpbmdzLlxuXHQgKlxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHNlcGFyYXRvciBwbGF0Zm9ybS1zcGVjaWZpYyBmaWxlIHNlcGFyYXRvclxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IGZyb20gW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHRvICAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9ICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVsYXRpdmUoc2VwYXJhdG9yLCBmcm9tLCB0bykge1xuXHQgIGFzc2VydEFyZ3VtZW50VHlwZShmcm9tLCAnZnJvbScsICdzdHJpbmcnKTtcblx0ICBhc3NlcnRBcmd1bWVudFR5cGUodG8sICd0bycsICdzdHJpbmcnKTtcblx0ICBpZiAoZnJvbSA9PT0gdG8pIHtcblx0ICAgIHJldHVybiAnJztcblx0ICB9XG5cdCAgZnJvbSA9IHJlc29sdmUoc2VwYXJhdG9yLCBbZnJvbV0pO1xuXHQgIHRvID0gcmVzb2x2ZShzZXBhcmF0b3IsIFt0b10pO1xuXHQgIGlmIChmcm9tID09PSB0bykge1xuXHQgICAgcmV0dXJuICcnO1xuXHQgIH1cblxuXHQgIC8vIHdlIG5vdyBoYXZlIHR3byBhYnNvbHV0ZSBwYXRocyxcblx0ICAvLyBsZXRzIFwiZ28gdXBcIiBmcm9tIGBmcm9tYCB1bnRpbCB3ZSByZWFjaCBjb21tb24gYmFzZSBkaXIgb2YgYHRvYFxuXHQgIC8vIGNvbnN0IG9yaWdpbmFsRnJvbSA9IGZyb207XG5cdCAgbGV0IHVwQ291bnQgPSAwO1xuXHQgIGxldCByZW1haW5pbmdQYXRoID0gJyc7XG5cdCAgd2hpbGUgKHRydWUpIHtcblx0ICAgIGlmICh0by5zdGFydHNXaXRoKGZyb20pKSB7XG5cdCAgICAgIC8vIG1hdGNoISByZWNvcmQgcmVzdC4uLj9cblx0ICAgICAgcmVtYWluaW5nUGF0aCA9IHRvLnNsaWNlKGZyb20ubGVuZ3RoKTtcblx0ICAgICAgYnJlYWs7XG5cdCAgICB9XG5cdCAgICAvLyBGSVhNRTogQnJlYWsvdGhyb3cgaWYgd2UgaGl0IGJhZCBlZGdlIGNhc2Ugb2Ygbm8gY29tbW9uIHJvb3QhXG5cdCAgICBmcm9tID0gZGlybmFtZShzZXBhcmF0b3IsIGZyb20pO1xuXHQgICAgdXBDb3VudCsrO1xuXHQgIH1cblx0ICAvLyByZW1vdmUgbGVhZGluZyBzZXBhcmF0b3IgZnJvbSByZW1haW5pbmdQYXRoIGlmIHRoZXJlIGlzIGFueVxuXHQgIGlmIChyZW1haW5pbmdQYXRoLmxlbmd0aCA+IDApIHtcblx0ICAgIHJlbWFpbmluZ1BhdGggPSByZW1haW5pbmdQYXRoLnNsaWNlKDEpO1xuXHQgIH1cblx0ICByZXR1cm4gKCcuLicgKyBzZXBhcmF0b3IpLnJlcGVhdCh1cENvdW50KSArIHJlbWFpbmluZ1BhdGg7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwYXRoLnBhcnNlKClgIG1ldGhvZCByZXR1cm5zIGFuIG9iamVjdCB3aG9zZSBwcm9wZXJ0aWVzIHJlcHJlc2VudFxuXHQgKiBzaWduaWZpY2FudCBlbGVtZW50cyBvZiB0aGUgcGF0aC4gVHJhaWxpbmcgZGlyZWN0b3J5IHNlcGFyYXRvcnMgYXJlIGlnbm9yZWQsXG5cdCAqIHNlZSBgcGF0aC5zZXBgLlxuXHQgKlxuXHQgKiBUaGUgcmV0dXJuZWQgb2JqZWN0IHdpbGwgaGF2ZSB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG5cdCAqXG5cdCAqIC0gZGlyIDxzdHJpbmc+XG5cdCAqIC0gcm9vdCA8c3RyaW5nPlxuXHQgKiAtIGJhc2UgPHN0cmluZz5cblx0ICogLSBuYW1lIDxzdHJpbmc+XG5cdCAqIC0gZXh0IDxzdHJpbmc+XG5cdCAqIEBwYXJhbSAge3N0cmluZ30gc2VwYXJhdG9yIHBsYXRmb3JtLXNwZWNpZmljIGZpbGUgc2VwYXJhdG9yXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gZmlsZXBhdGggW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcmV0dXJuIHtvYmplY3R9XG5cdCAqL1xuXHRmdW5jdGlvbiBwYXJzZShzZXBhcmF0b3IsIGZpbGVwYXRoKSB7XG5cdCAgYXNzZXJ0QXJndW1lbnRUeXBlKGZpbGVwYXRoLCAncGF0aCcsICdzdHJpbmcnKTtcblx0ICBjb25zdCByZXN1bHQgPSB7XG5cdCAgICByb290OiAnJyxcblx0ICAgIGRpcjogJycsXG5cdCAgICBiYXNlOiAnJyxcblx0ICAgIGV4dDogJycsXG5cdCAgICBuYW1lOiAnJ1xuXHQgIH07XG5cdCAgY29uc3QgbGVuZ3RoID0gZmlsZXBhdGgubGVuZ3RoO1xuXHQgIGlmIChsZW5ndGggPT09IDApIHtcblx0ICAgIHJldHVybiByZXN1bHQ7XG5cdCAgfVxuXG5cdCAgLy8gQ2hlYXQgYW5kIGp1c3QgY2FsbCBvdXIgb3RoZXIgbWV0aG9kcyBmb3IgZGlybmFtZS9iYXNlbmFtZS9leHRuYW1lP1xuXHQgIHJlc3VsdC5iYXNlID0gYmFzZW5hbWUoc2VwYXJhdG9yLCBmaWxlcGF0aCk7XG5cdCAgcmVzdWx0LmV4dCA9IGV4dG5hbWUoc2VwYXJhdG9yLCByZXN1bHQuYmFzZSk7XG5cdCAgY29uc3QgYmFzZUxlbmd0aCA9IHJlc3VsdC5iYXNlLmxlbmd0aDtcblx0ICByZXN1bHQubmFtZSA9IHJlc3VsdC5iYXNlLnNsaWNlKDAsIGJhc2VMZW5ndGggLSByZXN1bHQuZXh0Lmxlbmd0aCk7XG5cdCAgY29uc3QgdG9TdWJ0cmFjdCA9IGJhc2VMZW5ndGggPT09IDAgPyAwIDogYmFzZUxlbmd0aCArIDE7XG5cdCAgcmVzdWx0LmRpciA9IGZpbGVwYXRoLnNsaWNlKDAsIGZpbGVwYXRoLmxlbmd0aCAtIHRvU3VidHJhY3QpOyAvLyBkcm9wIHRyYWlsaW5nIHNlcGFyYXRvciFcblx0ICBjb25zdCBmaXJzdENoYXJDb2RlID0gZmlsZXBhdGguY2hhckNvZGVBdCgwKTtcblx0ICAvLyBib3RoIHdpbjMyIGFuZCBQT1NJWCByZXR1cm4gJy8nIHJvb3Rcblx0ICBpZiAoZmlyc3RDaGFyQ29kZSA9PT0gRk9SV0FSRF9TTEFTSCkge1xuXHQgICAgcmVzdWx0LnJvb3QgPSAnLyc7XG5cdCAgICByZXR1cm4gcmVzdWx0O1xuXHQgIH1cblx0ICAvLyB3ZSdyZSBkb25lIHdpdGggUE9TSVguLi5cblx0ICBpZiAoc2VwYXJhdG9yID09PSAnLycpIHtcblx0ICAgIHJldHVybiByZXN1bHQ7XG5cdCAgfVxuXHQgIC8vIGZvciB3aW4zMi4uLlxuXHQgIGlmIChmaXJzdENoYXJDb2RlID09PSBCQUNLV0FSRF9TTEFTSCkge1xuXHQgICAgLy8gRklYTUU6IEhhbmRsZSBVTkMgcGF0aHMgbGlrZSAnXFxcXFxcXFxob3N0LW5hbWVcXFxccmVzb3VyY2VcXFxcZmlsZV9wYXRoJ1xuXHQgICAgLy8gbmVlZCB0byByZXRhaW4gJ1xcXFxcXFxcaG9zdC1uYW1lXFxcXHJlc291cmNlXFxcXCcgYXMgcm9vdCBpbiB0aGF0IGNhc2UhXG5cdCAgICByZXN1bHQucm9vdCA9ICdcXFxcJztcblx0ICAgIHJldHVybiByZXN1bHQ7XG5cdCAgfVxuXHQgIC8vIGNoZWNrIGZvciBDOiBzdHlsZSByb290XG5cdCAgaWYgKGxlbmd0aCA+IDEgJiYgaXNXaW5kb3dzRGV2aWNlTmFtZShmaXJzdENoYXJDb2RlKSAmJiBmaWxlcGF0aC5jaGFyQXQoMSkgPT09ICc6Jykge1xuXHQgICAgaWYgKGxlbmd0aCA+IDIpIHtcblx0ICAgICAgLy8gaXMgaXQgbGlrZSBDOlxcXFw/XG5cdCAgICAgIGNvbnN0IHRoaXJkQ2hhckNvZGUgPSBmaWxlcGF0aC5jaGFyQ29kZUF0KDIpO1xuXHQgICAgICBpZiAodGhpcmRDaGFyQ29kZSA9PT0gRk9SV0FSRF9TTEFTSCB8fCB0aGlyZENoYXJDb2RlID09PSBCQUNLV0FSRF9TTEFTSCkge1xuXHQgICAgICAgIHJlc3VsdC5yb290ID0gZmlsZXBhdGguc2xpY2UoMCwgMyk7XG5cdCAgICAgICAgcmV0dXJuIHJlc3VsdDtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgLy8gbm9wZSwganVzdCBDOiwgbm8gdHJhaWxpbmcgc2VwYXJhdG9yXG5cdCAgICByZXN1bHQucm9vdCA9IGZpbGVwYXRoLnNsaWNlKDAsIDIpO1xuXHQgIH1cblx0ICByZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBgcGF0aC5mb3JtYXQoKWAgbWV0aG9kIHJldHVybnMgYSBwYXRoIHN0cmluZyBmcm9tIGFuIG9iamVjdC4gVGhpcyBpcyB0aGVcblx0ICogb3Bwb3NpdGUgb2YgYHBhdGgucGFyc2UoKWAuXG5cdCAqXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gc2VwYXJhdG9yIHBsYXRmb3JtLXNwZWNpZmljIGZpbGUgc2VwYXJhdG9yXG5cdCAqIEBwYXJhbSAge29iamVjdH0gcGF0aE9iamVjdCBvYmplY3Qgb2YgZm9ybWF0IHJldHVybmVkIGJ5IGBwYXRoLnBhcnNlKClgXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gcGF0aE9iamVjdC5kaXIgZGlyZWN0b3J5IG5hbWVcblx0ICogQHBhcmFtICB7c3RyaW5nfSBwYXRoT2JqZWN0LnJvb3QgZmlsZSByb290IGRpciwgaWdub3JlZCBpZiBgcGF0aE9iamVjdC5kaXJgIGlzIHByb3ZpZGVkXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gcGF0aE9iamVjdC5iYXNlIGZpbGUgYmFzZW5hbWVcblx0ICogQHBhcmFtICB7c3RyaW5nfSBwYXRoT2JqZWN0Lm5hbWUgYmFzZW5hbWUgbWludXMgZXh0ZW5zaW9uLCBpZ25vcmVkIGlmIGBwYXRoT2JqZWN0LmJhc2VgIGV4aXN0c1xuXHQgKiBAcGFyYW0gIHtzdHJpbmd9IHBhdGhPYmplY3QuZXh0IGZpbGUgZXh0ZW5zaW9uLCBpZ25vcmVkIGlmIGBwYXRoT2JqZWN0LmJhc2VgIGV4aXN0c1xuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XG5cdCAqL1xuXHRmdW5jdGlvbiBmb3JtYXQoc2VwYXJhdG9yLCBwYXRoT2JqZWN0KSB7XG5cdCAgYXNzZXJ0QXJndW1lbnRUeXBlKHBhdGhPYmplY3QsICdwYXRoT2JqZWN0JywgJ29iamVjdCcpO1xuXHQgIGNvbnN0IGJhc2UgPSBwYXRoT2JqZWN0LmJhc2UgfHwgYCR7cGF0aE9iamVjdC5uYW1lIHx8ICcnfSR7cGF0aE9iamVjdC5leHQgfHwgJyd9YDtcblxuXHQgIC8vIGFwcGVuZCBiYXNlIHRvIHJvb3QgaWYgYGRpcmAgd2Fzbid0IHNwZWNpZmllZCwgb3IgaWZcblx0ICAvLyBkaXIgaXMgdGhlIHJvb3Rcblx0ICBpZiAoIXBhdGhPYmplY3QuZGlyIHx8IHBhdGhPYmplY3QuZGlyID09PSBwYXRoT2JqZWN0LnJvb3QpIHtcblx0ICAgIHJldHVybiBgJHtwYXRoT2JqZWN0LnJvb3QgfHwgJyd9JHtiYXNlfWA7XG5cdCAgfVxuXHQgIC8vIGNvbWJpbmUgZGlyICsgLyArIGJhc2Vcblx0ICByZXR1cm4gYCR7cGF0aE9iamVjdC5kaXJ9JHtzZXBhcmF0b3J9JHtiYXNlfWA7XG5cdH1cblxuXHQvKipcblx0ICogT24gV2luZG93cyBzeXN0ZW1zIG9ubHksIHJldHVybnMgYW4gZXF1aXZhbGVudCBuYW1lc3BhY2UtcHJlZml4ZWQgcGF0aCBmb3Jcblx0ICogdGhlIGdpdmVuIHBhdGguIElmIHBhdGggaXMgbm90IGEgc3RyaW5nLCBwYXRoIHdpbGwgYmUgcmV0dXJuZWQgd2l0aG91dCBtb2RpZmljYXRpb25zLlxuXHQgKiBTZWUgaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvd2luZG93cy9kZXNrdG9wL0ZpbGVJTy9uYW1pbmctYS1maWxlI25hbWVzcGFjZXNcblx0ICogQHBhcmFtICB7c3RyaW5nfSBmaWxlcGF0aCBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gICAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0ZnVuY3Rpb24gdG9OYW1lc3BhY2VkUGF0aChmaWxlcGF0aCkge1xuXHQgIGlmICh0eXBlb2YgZmlsZXBhdGggIT09ICdzdHJpbmcnKSB7XG5cdCAgICByZXR1cm4gZmlsZXBhdGg7XG5cdCAgfVxuXHQgIGlmIChmaWxlcGF0aC5sZW5ndGggPT09IDApIHtcblx0ICAgIHJldHVybiAnJztcblx0ICB9XG5cdCAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcmVzb2x2ZSgnXFxcXCcsIFtmaWxlcGF0aF0pO1xuXHQgIGNvbnN0IGxlbmd0aCA9IHJlc29sdmVkUGF0aC5sZW5ndGg7XG5cdCAgaWYgKGxlbmd0aCA8IDIpIHtcblx0ICAgIC8vIG5lZWQgJ1xcXFxcXFxcJyBvciAnQzonIG1pbmltdW1cblx0ICAgIHJldHVybiBmaWxlcGF0aDtcblx0ICB9XG5cdCAgY29uc3QgZmlyc3RDaGFyQ29kZSA9IHJlc29sdmVkUGF0aC5jaGFyQ29kZUF0KDApO1xuXHQgIC8vIGlmIHN0YXJ0IHdpdGggJ1xcXFxcXFxcJywgcHJlZml4IHdpdGggVU5DIHJvb3QsIGRyb3AgdGhlIHNsYXNoZXNcblx0ICBpZiAoZmlyc3RDaGFyQ29kZSA9PT0gQkFDS1dBUkRfU0xBU0ggJiYgcmVzb2x2ZWRQYXRoLmNoYXJBdCgxKSA9PT0gJ1xcXFwnKSB7XG5cdCAgICAvLyByZXR1cm4gYXMtaXMgaWYgaXQncyBhbiBhcmVhZHkgbG9uZyBwYXRoICgnXFxcXFxcXFw/XFxcXCcgb3IgJ1xcXFxcXFxcLlxcXFwnIHByZWZpeClcblx0ICAgIGlmIChsZW5ndGggPj0gMykge1xuXHQgICAgICBjb25zdCB0aGlyZENoYXIgPSByZXNvbHZlZFBhdGguY2hhckF0KDIpO1xuXHQgICAgICBpZiAodGhpcmRDaGFyID09PSAnPycgfHwgdGhpcmRDaGFyID09PSAnLicpIHtcblx0ICAgICAgICByZXR1cm4gZmlsZXBhdGg7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIHJldHVybiAnXFxcXFxcXFw/XFxcXFVOQ1xcXFwnICsgcmVzb2x2ZWRQYXRoLnNsaWNlKDIpO1xuXHQgIH0gZWxzZSBpZiAoaXNXaW5kb3dzRGV2aWNlTmFtZShmaXJzdENoYXJDb2RlKSAmJiByZXNvbHZlZFBhdGguY2hhckF0KDEpID09PSAnOicpIHtcblx0ICAgIHJldHVybiAnXFxcXFxcXFw/XFxcXCcgKyByZXNvbHZlZFBhdGg7XG5cdCAgfVxuXHQgIHJldHVybiBmaWxlcGF0aDtcblx0fVxuXHRjb25zdCBXaW4zMlBhdGggPSB7XG5cdCAgc2VwOiAnXFxcXCcsXG5cdCAgZGVsaW1pdGVyOiAnOycsXG5cdCAgYmFzZW5hbWU6IGZ1bmN0aW9uIChmaWxlcGF0aCwgZXh0KSB7XG5cdCAgICByZXR1cm4gYmFzZW5hbWUodGhpcy5zZXAsIGZpbGVwYXRoLCBleHQpO1xuXHQgIH0sXG5cdCAgbm9ybWFsaXplOiBmdW5jdGlvbiAoZmlsZXBhdGgpIHtcblx0ICAgIHJldHVybiBub3JtYWxpemUodGhpcy5zZXAsIGZpbGVwYXRoKTtcblx0ICB9LFxuXHQgIGpvaW46IGZ1bmN0aW9uICgpIHtcblx0ICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBwYXRocyA9IG5ldyBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcblx0ICAgICAgcGF0aHNbX2tleV0gPSBhcmd1bWVudHNbX2tleV07XG5cdCAgICB9XG5cdCAgICByZXR1cm4gam9pbih0aGlzLnNlcCwgcGF0aHMpO1xuXHQgIH0sXG5cdCAgZXh0bmFtZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gZXh0bmFtZSh0aGlzLnNlcCwgZmlsZXBhdGgpO1xuXHQgIH0sXG5cdCAgZGlybmFtZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gZGlybmFtZSh0aGlzLnNlcCwgZmlsZXBhdGgpO1xuXHQgIH0sXG5cdCAgaXNBYnNvbHV0ZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gaXNBYnNvbHV0ZShmYWxzZSwgZmlsZXBhdGgpO1xuXHQgIH0sXG5cdCAgcmVsYXRpdmU6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuXHQgICAgcmV0dXJuIHJlbGF0aXZlKHRoaXMuc2VwLCBmcm9tLCB0byk7XG5cdCAgfSxcblx0ICByZXNvbHZlOiBmdW5jdGlvbiAoKSB7XG5cdCAgICBmb3IgKHZhciBfbGVuMiA9IGFyZ3VtZW50cy5sZW5ndGgsIHBhdGhzID0gbmV3IEFycmF5KF9sZW4yKSwgX2tleTIgPSAwOyBfa2V5MiA8IF9sZW4yOyBfa2V5MisrKSB7XG5cdCAgICAgIHBhdGhzW19rZXkyXSA9IGFyZ3VtZW50c1tfa2V5Ml07XG5cdCAgICB9XG5cdCAgICByZXR1cm4gcmVzb2x2ZSh0aGlzLnNlcCwgcGF0aHMpO1xuXHQgIH0sXG5cdCAgcGFyc2U6IGZ1bmN0aW9uIChmaWxlcGF0aCkge1xuXHQgICAgcmV0dXJuIHBhcnNlKHRoaXMuc2VwLCBmaWxlcGF0aCk7XG5cdCAgfSxcblx0ICBmb3JtYXQ6IGZ1bmN0aW9uIChwYXRoT2JqZWN0KSB7XG5cdCAgICByZXR1cm4gZm9ybWF0KHRoaXMuc2VwLCBwYXRoT2JqZWN0KTtcblx0ICB9LFxuXHQgIHRvTmFtZXNwYWNlZFBhdGg6IHRvTmFtZXNwYWNlZFBhdGhcblx0fTtcblx0Y29uc3QgUG9zaXhQYXRoID0ge1xuXHQgIHNlcDogJy8nLFxuXHQgIGRlbGltaXRlcjogJzonLFxuXHQgIGJhc2VuYW1lOiBmdW5jdGlvbiAoZmlsZXBhdGgsIGV4dCkge1xuXHQgICAgcmV0dXJuIGJhc2VuYW1lKHRoaXMuc2VwLCBmaWxlcGF0aCwgZXh0KTtcblx0ICB9LFxuXHQgIG5vcm1hbGl6ZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gbm9ybWFsaXplKHRoaXMuc2VwLCBmaWxlcGF0aCk7XG5cdCAgfSxcblx0ICBqb2luOiBmdW5jdGlvbiAoKSB7XG5cdCAgICBmb3IgKHZhciBfbGVuMyA9IGFyZ3VtZW50cy5sZW5ndGgsIHBhdGhzID0gbmV3IEFycmF5KF9sZW4zKSwgX2tleTMgPSAwOyBfa2V5MyA8IF9sZW4zOyBfa2V5MysrKSB7XG5cdCAgICAgIHBhdGhzW19rZXkzXSA9IGFyZ3VtZW50c1tfa2V5M107XG5cdCAgICB9XG5cdCAgICByZXR1cm4gam9pbih0aGlzLnNlcCwgcGF0aHMpO1xuXHQgIH0sXG5cdCAgZXh0bmFtZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gZXh0bmFtZSh0aGlzLnNlcCwgZmlsZXBhdGgpO1xuXHQgIH0sXG5cdCAgZGlybmFtZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gZGlybmFtZSh0aGlzLnNlcCwgZmlsZXBhdGgpO1xuXHQgIH0sXG5cdCAgaXNBYnNvbHV0ZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gaXNBYnNvbHV0ZSh0cnVlLCBmaWxlcGF0aCk7XG5cdCAgfSxcblx0ICByZWxhdGl2ZTogZnVuY3Rpb24gKGZyb20sIHRvKSB7XG5cdCAgICByZXR1cm4gcmVsYXRpdmUodGhpcy5zZXAsIGZyb20sIHRvKTtcblx0ICB9LFxuXHQgIHJlc29sdmU6IGZ1bmN0aW9uICgpIHtcblx0ICAgIGZvciAodmFyIF9sZW40ID0gYXJndW1lbnRzLmxlbmd0aCwgcGF0aHMgPSBuZXcgQXJyYXkoX2xlbjQpLCBfa2V5NCA9IDA7IF9rZXk0IDwgX2xlbjQ7IF9rZXk0KyspIHtcblx0ICAgICAgcGF0aHNbX2tleTRdID0gYXJndW1lbnRzW19rZXk0XTtcblx0ICAgIH1cblx0ICAgIHJldHVybiByZXNvbHZlKHRoaXMuc2VwLCBwYXRocyk7XG5cdCAgfSxcblx0ICBwYXJzZTogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gcGFyc2UodGhpcy5zZXAsIGZpbGVwYXRoKTtcblx0ICB9LFxuXHQgIGZvcm1hdDogZnVuY3Rpb24gKHBhdGhPYmplY3QpIHtcblx0ICAgIHJldHVybiBmb3JtYXQodGhpcy5zZXAsIHBhdGhPYmplY3QpO1xuXHQgIH0sXG5cdCAgdG9OYW1lc3BhY2VkUGF0aDogZnVuY3Rpb24gKGZpbGVwYXRoKSB7XG5cdCAgICByZXR1cm4gZmlsZXBhdGg7IC8vIG5vLW9wXG5cdCAgfVxuXHR9O1xuXG5cdGNvbnN0IHBhdGggPSBQb3NpeFBhdGg7XG5cdHBhdGgud2luMzIgPSBXaW4zMlBhdGg7XG5cdHBhdGgucG9zaXggPSBQb3NpeFBhdGg7XG5cblx0LyoqXG5cdCAqIFRpdGFuaXVtIFNES1xuXHQgKiBDb3B5cmlnaHQgVGlEZXYsIEluYy4gMDQvMDcvMjAyMi1QcmVzZW50LiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuXHQgKiBMaWNlbnNlZCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEFwYWNoZSBQdWJsaWMgTGljZW5zZVxuXHQgKiBQbGVhc2Ugc2VlIHRoZSBMSUNFTlNFIGluY2x1ZGVkIHdpdGggdGhpcyBkaXN0cmlidXRpb24gZm9yIGRldGFpbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBib290c3RyYXAkMihnbG9iYWwsIGtyb2xsKSB7XG5cdCAgY29uc3QgYXNzZXRzID0ga3JvbGwuYmluZGluZygnYXNzZXRzJyk7XG5cdCAgY29uc3QgU2NyaXB0ID0ga3JvbGwuYmluZGluZygnU2NyaXB0Jyk7XG5cblx0ICAvKipcblx0ICAgKiBUaGUgbG9hZGVkIGluZGV4Lmpzb24gZmlsZSBmcm9tIHRoZSBhcHAuIFVzZWQgdG8gc3RvcmUgdGhlIGVuY3J5cHRlZCBKUyBhc3NldHMnXG5cdCAgICogZmlsZW5hbWVzL29mZnNldHMuXG5cdCAgICovXG5cdCAgbGV0IGZpbGVJbmRleDtcblx0ICAvLyBGSVhNRTogZml4IGZpbGUgbmFtZSBwYXJpdHkgYmV0d2VlbiBwbGF0Zm9ybXNcblx0ICBjb25zdCBJTkRFWF9KU09OID0gJy9faW5kZXhfLmpzb24nO1xuXHQgIGNsYXNzIE1vZHVsZSB7XG5cdCAgICAvKipcblx0ICAgICAqIFtNb2R1bGUgZGVzY3JpcHRpb25dXG5cdCAgICAgKiBAcGFyYW0ge3N0cmluZ30gaWQgICAgICBtb2R1bGUgaWRcblx0ICAgICAqIEBwYXJhbSB7TW9kdWxlfSBwYXJlbnQgIHBhcmVudCBtb2R1bGVcblx0ICAgICAqL1xuXHQgICAgY29uc3RydWN0b3IoaWQsIHBhcmVudCkge1xuXHQgICAgICB0aGlzLmlkID0gaWQ7XG5cdCAgICAgIHRoaXMuZXhwb3J0cyA9IHt9O1xuXHQgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcblx0ICAgICAgdGhpcy5maWxlbmFtZSA9IG51bGw7XG5cdCAgICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG5cdCAgICAgIHRoaXMud3JhcHBlckNhY2hlID0ge307XG5cdCAgICAgIHRoaXMuaXNTZXJ2aWNlID0gZmFsc2U7IC8vIHRvZ2dsZWQgb24gaWYgdGhpcyBtb2R1bGUgaXMgdGhlIHNlcnZpY2UgZW50cnkgcG9pbnRcblx0ICAgIH1cblxuXHQgICAgLyoqXG5cdCAgICAgKiBBdHRlbXB0cyB0byBsb2FkIHRoZSBtb2R1bGUuIElmIG5vIGZpbGUgaXMgZm91bmRcblx0ICAgICAqIHdpdGggdGhlIHByb3ZpZGVkIG5hbWUgYW4gZXhjZXB0aW9uIHdpbGwgYmUgdGhyb3duLlxuXHQgICAgICogT25jZSB0aGUgY29udGVudHMgb2YgdGhlIGZpbGUgYXJlIHJlYWQsIGl0IGlzIHJ1blxuXHQgICAgICogaW4gdGhlIGN1cnJlbnQgY29udGV4dC4gQSBzYW5kYm94IGlzIGNyZWF0ZWQgYnlcblx0ICAgICAqIGV4ZWN1dGluZyB0aGUgY29kZSBpbnNpZGUgYSB3cmFwcGVyIGZ1bmN0aW9uLlxuXHQgICAgICogVGhpcyBwcm92aWRlcyBhIHNwZWVkIGJvb3N0IHZzIGNyZWF0aW5nIGEgbmV3IGNvbnRleHQuXG5cdCAgICAgKlxuXHQgICAgICogQHBhcmFtICB7U3RyaW5nfSBmaWxlbmFtZSBbZGVzY3JpcHRpb25dXG5cdCAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IHNvdXJjZSAgIFtkZXNjcmlwdGlvbl1cblx0ICAgICAqIEByZXR1cm5zIHt2b2lkfVxuXHQgICAgICovXG5cdCAgICBsb2FkKGZpbGVuYW1lLCBzb3VyY2UpIHtcblx0ICAgICAgaWYgKHRoaXMubG9hZGVkKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb2R1bGUgYWxyZWFkeSBsb2FkZWQuJyk7XG5cdCAgICAgIH1cblx0ICAgICAgdGhpcy5maWxlbmFtZSA9IGZpbGVuYW1lO1xuXHQgICAgICB0aGlzLnBhdGggPSBwYXRoLmRpcm5hbWUoZmlsZW5hbWUpO1xuXHQgICAgICB0aGlzLnBhdGhzID0gdGhpcy5ub2RlTW9kdWxlc1BhdGhzKHRoaXMucGF0aCk7XG5cdCAgICAgIGlmICghc291cmNlKSB7XG5cdCAgICAgICAgc291cmNlID0gYXNzZXRzLnJlYWRBc3NldChmaWxlbmFtZSk7XG5cdCAgICAgIH1cblxuXHQgICAgICAvLyBTdGljayBpdCBpbiB0aGUgY2FjaGVcblx0ICAgICAgTW9kdWxlLmNhY2hlW3RoaXMuZmlsZW5hbWVdID0gdGhpcztcblx0ICAgICAgdGhpcy5fcnVuU2NyaXB0KHNvdXJjZSwgdGhpcy5maWxlbmFtZSk7XG5cdCAgICAgIHRoaXMubG9hZGVkID0gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgLyoqXG5cdCAgICAgKiBHZW5lcmF0ZXMgYSBjb250ZXh0LXNwZWNpZmljIG1vZHVsZSB3cmFwcGVyLCBhbmQgd3JhcHNcblx0ICAgICAqIGVhY2ggaW52b2NhdGlvbiBBUEkgaW4gYW4gZXh0ZXJuYWwgKDNyZCBwYXJ0eSkgbW9kdWxlXG5cdCAgICAgKiBTZWUgaW52b2tlci5qcyBmb3IgbW9yZSBpbmZvXG5cdCAgICAgKiBAcGFyYW0gIHtvYmplY3R9IGV4dGVybmFsTW9kdWxlIG5hdGl2ZSBtb2R1bGUgcHJveHlcblx0ICAgICAqIEBwYXJhbSAge3N0cmluZ30gc291cmNlVXJsICAgICAgdGhlIGN1cnJlbnQganMgZmlsZSB1cmxcblx0ICAgICAqIEByZXR1cm4ge29iamVjdH0gICAgICAgICAgICAgICAgd3JhcHBlciBhcm91bmQgdGhlIGV4dGVybmFsTW9kdWxlXG5cdCAgICAgKi9cblx0ICAgIGNyZWF0ZU1vZHVsZVdyYXBwZXIoZXh0ZXJuYWxNb2R1bGUsIHNvdXJjZVVybCkge1xuXHQgICAgICB7XG5cdCAgICAgICAgLy8gaU9TIGRvZXMgbm90IG5lZWQgYSBtb2R1bGUgd3JhcHBlciwgcmV0dXJuIG9yaWdpbmFsIGV4dGVybmFsIG1vZHVsZVxuXHQgICAgICAgIHJldHVybiBleHRlcm5hbE1vZHVsZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICAvKipcblx0ICAgICAqIFRha2VzIGEgQ29tbW9uSlMgbW9kdWxlIGFuZCB1c2VzIGl0IHRvIGV4dGVuZCBhbiBleGlzdGluZyBleHRlcm5hbC9uYXRpdmUgbW9kdWxlLiBUaGUgZXhwb3J0cyBhcmUgYWRkZWQgdG8gdGhlIGV4dGVybmFsIG1vZHVsZS5cblx0ICAgICAqIEBwYXJhbSAge09iamVjdH0gZXh0ZXJuYWxNb2R1bGUgVGhlIGV4dGVybmFsL25hdGl2ZSBtb2R1bGUgd2UncmUgZXh0ZW5kaW5nXG5cdCAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IGlkICAgICAgICAgICAgIG1vZHVsZSBpZFxuXHQgICAgICovXG5cdCAgICBleHRlbmRNb2R1bGVXaXRoQ29tbW9uSnMoZXh0ZXJuYWxNb2R1bGUsIGlkKSB7XG5cdCAgICAgIGlmICgha3JvbGwuaXNFeHRlcm5hbENvbW1vbkpzTW9kdWxlKGlkKSkge1xuXHQgICAgICAgIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIC8vIExvYWQgdW5kZXIgZmFrZSBuYW1lLCBvciB0aGUgY29tbW9uanMgc2lkZSBvZiB0aGUgbmF0aXZlIG1vZHVsZSBnZXRzIGNhY2hlZCBpbiBwbGFjZSBvZiB0aGUgbmF0aXZlIG1vZHVsZSFcblx0ICAgICAgLy8gU2VlIFRJTU9CLTI0OTMyXG5cdCAgICAgIGNvbnN0IGZha2VJZCA9IGAke2lkfS5jb21tb25qc2A7XG5cdCAgICAgIGNvbnN0IGpzTW9kdWxlID0gbmV3IE1vZHVsZShmYWtlSWQsIHRoaXMpO1xuXHQgICAgICBqc01vZHVsZS5sb2FkKGZha2VJZCwga3JvbGwuZ2V0RXh0ZXJuYWxDb21tb25Kc01vZHVsZShpZCkpO1xuXHQgICAgICBpZiAoanNNb2R1bGUuZXhwb3J0cykge1xuXHQgICAgICAgIGNvbnNvbGUudHJhY2UoYEV4dGVuZGluZyBuYXRpdmUgbW9kdWxlICcke2lkfScgd2l0aCB0aGUgQ29tbW9uSlMgbW9kdWxlIHRoYXQgd2FzIHBhY2thZ2VkIHdpdGggaXQuYCk7XG5cdCAgICAgICAga3JvbGwuZXh0ZW5kKGV4dGVybmFsTW9kdWxlLCBqc01vZHVsZS5leHBvcnRzKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICAvKipcblx0ICAgICAqIExvYWRzIGEgbmF0aXZlIC8gZXh0ZXJuYWwgKDNyZCBwYXJ0eSkgbW9kdWxlXG5cdCAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IGlkICAgICAgICAgICAgICBtb2R1bGUgaWRcblx0ICAgICAqIEBwYXJhbSAge29iamVjdH0gZXh0ZXJuYWxCaW5kaW5nIGV4dGVybmFsIGJpbmRpbmcgb2JqZWN0XG5cdCAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgICAgICBUaGUgZXhwb3J0ZWQgbW9kdWxlXG5cdCAgICAgKi9cblx0ICAgIGxvYWRFeHRlcm5hbE1vZHVsZShpZCwgZXh0ZXJuYWxCaW5kaW5nKSB7XG5cdCAgICAgIC8vIHRyeSB0byBnZXQgdGhlIGNhY2hlZCBtb2R1bGUuLi5cblx0ICAgICAgbGV0IGV4dGVybmFsTW9kdWxlID0gTW9kdWxlLmNhY2hlW2lkXTtcblx0ICAgICAgaWYgKCFleHRlcm5hbE1vZHVsZSkge1xuXHQgICAgICAgIC8vIGlPUyBhbmQgQW5kcm9pZCBkaWZmZXIgcXVpdGUgYSBiaXQgaGVyZS5cblx0ICAgICAgICAvLyBXaXRoIGlvcywgd2Ugc2hvdWxkIGFscmVhZHkgaGF2ZSB0aGUgbmF0aXZlIG1vZHVsZSBsb2FkZWRcblx0ICAgICAgICAvLyBUaGVyZSdzIG5vIHNwZWNpYWwgXCJib290c3RyYXAuanNcIiBmaWxlIHBhY2thZ2VkIHdpdGhpbiBpdFxuXHQgICAgICAgIC8vIE9uIEFuZHJvaWQsIHdlIGxvYWQgYSBib290c3RyYXAuanMgYnVuZGxlZCB3aXRoIHRoZSBtb2R1bGVcblx0ICAgICAgICB7XG5cdCAgICAgICAgICBleHRlcm5hbE1vZHVsZSA9IGV4dGVybmFsQmluZGluZztcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgICAgaWYgKCFleHRlcm5hbE1vZHVsZSkge1xuXHQgICAgICAgIGNvbnNvbGUudHJhY2UoYFVuYWJsZSB0byBsb2FkIGV4dGVybmFsIG1vZHVsZTogJHtpZH1gKTtcblx0ICAgICAgICByZXR1cm4gbnVsbDtcblx0ICAgICAgfVxuXG5cdCAgICAgIC8vIGNhY2hlIHRoZSBsb2FkZWQgbmF0aXZlIG1vZHVsZSAoYmVmb3JlIHdlIGV4dGVuZCBpdClcblx0ICAgICAgTW9kdWxlLmNhY2hlW2lkXSA9IGV4dGVybmFsTW9kdWxlO1xuXG5cdCAgICAgIC8vIFdlIGNhY2hlIGVhY2ggY29udGV4dC1zcGVjaWZpYyBtb2R1bGUgd3JhcHBlclxuXHQgICAgICAvLyBvbiB0aGUgcGFyZW50IG1vZHVsZSwgcmF0aGVyIHRoYW4gaW4gdGhlIE1vZHVsZS5jYWNoZVxuXHQgICAgICBsZXQgd3JhcHBlciA9IHRoaXMud3JhcHBlckNhY2hlW2lkXTtcblx0ICAgICAgaWYgKHdyYXBwZXIpIHtcblx0ICAgICAgICByZXR1cm4gd3JhcHBlcjtcblx0ICAgICAgfVxuXHQgICAgICBjb25zdCBzb3VyY2VVcmwgPSBgYXBwOi8vJHt0aGlzLmZpbGVuYW1lfWA7IC8vIEZJWE1FOiBJZiB0aGlzLmZpbGVuYW1lIHN0YXJ0cyB3aXRoICcvJywgd2UgbmVlZCB0byBkcm9wIGl0LCBJIHRoaW5rP1xuXHQgICAgICB3cmFwcGVyID0gdGhpcy5jcmVhdGVNb2R1bGVXcmFwcGVyKGV4dGVybmFsTW9kdWxlLCBzb3VyY2VVcmwpO1xuXG5cdCAgICAgIC8vIFRoZW4gd2UgXCJleHRlbmRcIiB0aGUgQVBJL21vZHVsZSB1c2luZyBhbnkgc2hpcHBlZCBKUyBjb2RlIChhc3NldHMvPG1vZHVsZS5pZD4uanMpXG5cdCAgICAgIHRoaXMuZXh0ZW5kTW9kdWxlV2l0aENvbW1vbkpzKHdyYXBwZXIsIGlkKTtcblx0ICAgICAgdGhpcy53cmFwcGVyQ2FjaGVbaWRdID0gd3JhcHBlcjtcblx0ICAgICAgcmV0dXJuIHdyYXBwZXI7XG5cdCAgICB9XG5cblx0ICAgIC8vIFNlZSBodHRwczovL25vZGVqcy5vcmcvYXBpL21vZHVsZXMuaHRtbCNtb2R1bGVzX2FsbF90b2dldGhlclxuXG5cdCAgICAvKipcblx0ICAgICAqIFJlcXVpcmUgYW5vdGhlciBtb2R1bGUgYXMgYSBjaGlsZCBvZiB0aGlzIG1vZHVsZS5cblx0ICAgICAqIFRoaXMgcGFyZW50IG1vZHVsZSdzIHBhdGggaXMgdXNlZCBhcyB0aGUgYmFzZSBmb3IgcmVsYXRpdmUgcGF0aHNcblx0ICAgICAqIHdoZW4gbG9hZGluZyB0aGUgY2hpbGQuIFJldHVybnMgdGhlIGV4cG9ydHMgb2JqZWN0XG5cdCAgICAgKiBvZiB0aGUgY2hpbGQgbW9kdWxlLlxuXHQgICAgICpcblx0ICAgICAqIEBwYXJhbSAge1N0cmluZ30gcmVxdWVzdCAgVGhlIHBhdGggdG8gdGhlIHJlcXVlc3RlZCBtb2R1bGVcblx0ICAgICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgVGhlIGxvYWRlZCBtb2R1bGVcblx0ICAgICAqL1xuXHQgICAgcmVxdWlyZShyZXF1ZXN0KSB7XG5cdCAgICAgIC8vIDIuIElmIFggYmVnaW5zIHdpdGggJy4vJyBvciAnLycgb3IgJy4uLydcblx0ICAgICAgY29uc3Qgc3RhcnQgPSByZXF1ZXN0LnN1YnN0cmluZygwLCAyKTsgLy8gaGFjayB1cCB0aGUgc3RhcnQgb2YgdGhlIHN0cmluZyB0byBjaGVjayByZWxhdGl2ZS9hYnNvbHV0ZS9cIm5ha2VkXCIgbW9kdWxlIGlkXG5cdCAgICAgIGlmIChzdGFydCA9PT0gJy4vJyB8fCBzdGFydCA9PT0gJy4uJykge1xuXHQgICAgICAgIGNvbnN0IGxvYWRlZCA9IHRoaXMubG9hZEFzRmlsZU9yRGlyZWN0b3J5KHBhdGgubm9ybWFsaXplKHRoaXMucGF0aCArICcvJyArIHJlcXVlc3QpKTtcblx0ICAgICAgICBpZiAobG9hZGVkKSB7XG5cdCAgICAgICAgICByZXR1cm4gbG9hZGVkLmV4cG9ydHM7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIC8vIFJvb3QvYWJzb2x1dGUgcGF0aCAoaW50ZXJuYWxseSB3aGVuIHJlYWRpbmcgdGhlIGZpbGUsIHdlIHByZXBlbmQgXCJSZXNvdXJjZXMvXCIgYXMgcm9vdCBkaXIpXG5cdCAgICAgIH0gZWxzZSBpZiAocmVxdWVzdC5zdWJzdHJpbmcoMCwgMSkgPT09ICcvJykge1xuXHQgICAgICAgIGNvbnN0IGxvYWRlZCA9IHRoaXMubG9hZEFzRmlsZU9yRGlyZWN0b3J5KHBhdGgubm9ybWFsaXplKHJlcXVlc3QpKTtcblx0ICAgICAgICBpZiAobG9hZGVkKSB7XG5cdCAgICAgICAgICByZXR1cm4gbG9hZGVkLmV4cG9ydHM7XG5cdCAgICAgICAgfVxuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIC8vIERlc3BpdGUgYmVpbmcgc3RlcCAxIGluIE5vZGUuSlMgcHN1ZWRvLWNvZGUsIHdlIG1vdmVkIGl0IGRvd24gaGVyZSBiZWNhdXNlIHdlIGRvbid0IGFsbG93IG5hdGl2ZSBtb2R1bGVzXG5cdCAgICAgICAgLy8gdG8gc3RhcnQgd2l0aCAnLi8nLCAnLi4nIG9yICcvJyAtIHNvIHRoaXMgYXZvaWRzIGEgbG90IG9mIG1pc3NlcyBvbiByZXF1aXJlcyBzdGFydGluZyB0aGF0IHdheVxuXG5cdCAgICAgICAgLy8gMS4gSWYgWCBpcyBhIGNvcmUgbW9kdWxlLFxuXHQgICAgICAgIGxldCBsb2FkZWQgPSB0aGlzLmxvYWRDb3JlTW9kdWxlKHJlcXVlc3QpO1xuXHQgICAgICAgIGlmIChsb2FkZWQpIHtcblx0ICAgICAgICAgIC8vIGEuIHJldHVybiB0aGUgY29yZSBtb2R1bGVcblx0ICAgICAgICAgIC8vIGIuIFNUT1Bcblx0ICAgICAgICAgIHJldHVybiBsb2FkZWQ7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgLy8gTG9vayBmb3IgQ29tbW9uSlMgbW9kdWxlXG5cdCAgICAgICAgaWYgKHJlcXVlc3QuaW5kZXhPZignLycpID09PSAtMSkge1xuXHQgICAgICAgICAgLy8gRm9yIENvbW1vbkpTIHdlIG5lZWQgdG8gbG9vayBmb3IgbW9kdWxlLmlkL21vZHVsZS5pZC5qcyBmaXJzdC4uLlxuXHQgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBgLyR7cmVxdWVzdH0vJHtyZXF1ZXN0fS5qc2A7XG5cdCAgICAgICAgICAvLyBPbmx5IGxvb2sgZm9yIHRoaXMgX2V4YWN0IGZpbGVfLiBETyBOT1QgQVBQRU5EIC5qcyBvciAuanNvbiB0byBpdCFcblx0ICAgICAgICAgIGlmICh0aGlzLmZpbGVuYW1lRXhpc3RzKGZpbGVuYW1lKSkge1xuXHQgICAgICAgICAgICBsb2FkZWQgPSB0aGlzLmxvYWRKYXZhc2NyaXB0VGV4dChmaWxlbmFtZSk7XG5cdCAgICAgICAgICAgIGlmIChsb2FkZWQpIHtcblx0ICAgICAgICAgICAgICByZXR1cm4gbG9hZGVkLmV4cG9ydHM7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgLy8gVGhlbiB0cnkgbW9kdWxlLmlkIGFzIGRpcmVjdG9yeVxuXHQgICAgICAgICAgbG9hZGVkID0gdGhpcy5sb2FkQXNEaXJlY3RvcnkoYC8ke3JlcXVlc3R9YCk7XG5cdCAgICAgICAgICBpZiAobG9hZGVkKSB7XG5cdCAgICAgICAgICAgIHJldHVybiBsb2FkZWQuZXhwb3J0cztcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICAvLyBBbGxvdyBsb29raW5nIHRocm91Z2ggbm9kZV9tb2R1bGVzXG5cdCAgICAgICAgLy8gMy4gTE9BRF9OT0RFX01PRFVMRVMoWCwgZGlybmFtZShZKSlcblx0ICAgICAgICBsb2FkZWQgPSB0aGlzLmxvYWROb2RlTW9kdWxlcyhyZXF1ZXN0LCB0aGlzLnBhdGhzKTtcblx0ICAgICAgICBpZiAobG9hZGVkKSB7XG5cdCAgICAgICAgICByZXR1cm4gbG9hZGVkLmV4cG9ydHM7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgLy8gRmFsbGJhY2sgdG8gb2xkIFRpdGFuaXVtIGJlaGF2aW9yIG9mIGFzc3VtaW5nIGl0J3MgYWN0dWFsbHkgYW4gYWJzb2x1dGUgcGF0aFxuXG5cdCAgICAgICAgLy8gV2UnZCBsaWtlIHRvIHdhcm4gdXNlcnMgYWJvdXQgbGVnYWN5IHN0eWxlIHJlcXVpcmUgc3ludGF4IHNvIHRoZXkgY2FuIHVwZGF0ZSwgYnV0IHRoZSBuZXcgc3ludGF4IGlzIG5vdCBiYWNrd2FyZHMgY29tcGF0aWJsZS5cblx0ICAgICAgICAvLyBTbyBmb3Igbm93LCBsZXQncyBqdXN0IGJlIHF1aXRlIGFib3V0IGl0LiBJbiBmdXR1cmUgdmVyc2lvbnMgb2YgdGhlIFNESyAoNy4wPykgd2Ugc2hvdWxkIHdhcm4gKG9uY2UgNS54IGlzIGVuZCBvZiBsaWZlIHNvIGJhY2t3YXJkcyBjb21wYXQgaXMgbm90IG5lY2Vzc2FyeSlcblx0ICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbWF4LWxlblxuXHQgICAgICAgIC8vIGNvbnNvbGUud2FybihgcmVxdWlyZSBjYWxsZWQgd2l0aCB1bi1wcmVmaXhlZCBtb2R1bGUgaWQ6ICR7cmVxdWVzdH0sIHNob3VsZCBiZSBhIGNvcmUgb3IgQ29tbW9uSlMgbW9kdWxlLiBGYWxsaW5nIGJhY2sgdG8gb2xkIFRpIGJlaGF2aW9yIGFuZCBhc3N1bWluZyBpdCdzIGFuIGFic29sdXRlIHBhdGg6IC8ke3JlcXVlc3R9YCk7XG5cblx0ICAgICAgICBsb2FkZWQgPSB0aGlzLmxvYWRBc0ZpbGVPckRpcmVjdG9yeShwYXRoLm5vcm1hbGl6ZShgLyR7cmVxdWVzdH1gKSk7XG5cdCAgICAgICAgaWYgKGxvYWRlZCkge1xuXHQgICAgICAgICAgcmV0dXJuIGxvYWRlZC5leHBvcnRzO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIC8vIDQuIFRIUk9XIFwibm90IGZvdW5kXCJcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZXF1ZXN0ZWQgbW9kdWxlIG5vdCBmb3VuZDogJHtyZXF1ZXN0fWApOyAvLyBUT0RPIFNldCAnY29kZScgcHJvcGVydHkgdG8gJ01PRFVMRV9OT1RfRk9VTkQnIHRvIG1hdGNoIE5vZGU/XG5cdCAgICB9XG5cblx0ICAgIC8qKlxuXHQgICAgICogTG9hZHMgdGhlIGNvcmUgbW9kdWxlIGlmIGl0IGV4aXN0cy4gSWYgbm90LCByZXR1cm5zIG51bGwuXG5cdCAgICAgKlxuXHQgICAgICogQHBhcmFtICB7U3RyaW5nfSAgaWQgVGhlIHJlcXVlc3QgbW9kdWxlIGlkXG5cdCAgICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgIHRydWUgaWYgdGhlIG1vZHVsZSBpZCBtYXRjaGVzIGEgbmF0aXZlIG9yIENvbW1vbkpTIG1vZHVsZSBpZCwgKG9yIGl0J3MgZmlyc3QgcGF0aCBzZWdtZW50IGRvZXMpLlxuXHQgICAgICovXG5cdCAgICBsb2FkQ29yZU1vZHVsZShpZCkge1xuXHQgICAgICAvLyBza2lwIGJhZCBpZHMsIHJlbGF0aXZlIGlkcywgYWJzb2x1dGUgaWRzLiBcIm5hdGl2ZVwiL1wiY29yZVwiIG1vZHVsZXMgc2hvdWxkIGJlIG9mIGZvcm0gXCJtb2R1bGUuaWRcIiBvciBcIm1vZHVsZS5pZC9zdWIuZmlsZS5qc1wiXG5cdCAgICAgIGlmICghaWQgfHwgaWQuc3RhcnRzV2l0aCgnLicpIHx8IGlkLnN0YXJ0c1dpdGgoJy8nKSkge1xuXHQgICAgICAgIHJldHVybiBudWxsO1xuXHQgICAgICB9XG5cblx0ICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBhIGNhY2hlZCBjb3B5IG9mIHRoZSB3cmFwcGVyXG5cdCAgICAgIGlmICh0aGlzLndyYXBwZXJDYWNoZVtpZF0pIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy53cmFwcGVyQ2FjaGVbaWRdO1xuXHQgICAgICB9XG5cdCAgICAgIGNvbnN0IHBhcnRzID0gaWQuc3BsaXQoJy8nKTtcblx0ICAgICAgY29uc3QgZXh0ZXJuYWxCaW5kaW5nID0ga3JvbGwuZXh0ZXJuYWxCaW5kaW5nKHBhcnRzWzBdKTtcblx0ICAgICAgaWYgKGV4dGVybmFsQmluZGluZykge1xuXHQgICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDEpIHtcblx0ICAgICAgICAgIC8vIFRoaXMgaXMgdGhlIFwicm9vdFwiIG9mIGFuIGV4dGVybmFsIG1vZHVsZS4gSXQgY2FuIGxvb2sgbGlrZTpcblx0ICAgICAgICAgIC8vIHJlcXVlc3QoXCJjb20uZXhhbXBsZS5teW1vZHVsZVwiKVxuXHQgICAgICAgICAgLy8gV2UgY2FuIGxvYWQgYW5kIHJldHVybiBpdCByaWdodCBhd2F5IChjYWNoaW5nIG9jY3VycyBpbiB0aGUgY2FsbGVkIGZ1bmN0aW9uKS5cblx0ICAgICAgICAgIHJldHVybiB0aGlzLmxvYWRFeHRlcm5hbE1vZHVsZShwYXJ0c1swXSwgZXh0ZXJuYWxCaW5kaW5nKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICAvLyBDb3VsZCBiZSBhIHN1Yi1tb2R1bGUgKENvbW1vbkpTKSBvZiBhbiBleHRlcm5hbCBuYXRpdmUgbW9kdWxlLlxuXHQgICAgICAgIC8vIFdlIGFsbG93IHRoYXQgc2luY2UgVElNT0ItOTczMC5cblx0ICAgICAgICBpZiAoa3JvbGwuaXNFeHRlcm5hbENvbW1vbkpzTW9kdWxlKHBhcnRzWzBdKSkge1xuXHQgICAgICAgICAgY29uc3QgZXh0ZXJuYWxDb21tb25Kc0NvbnRlbnRzID0ga3JvbGwuZ2V0RXh0ZXJuYWxDb21tb25Kc01vZHVsZShpZCk7XG5cdCAgICAgICAgICBpZiAoZXh0ZXJuYWxDb21tb25Kc0NvbnRlbnRzKSB7XG5cdCAgICAgICAgICAgIC8vIGZvdW5kIGl0XG5cdCAgICAgICAgICAgIC8vIEZJWE1FIFJlLXVzZSBsb2FkQXNKYXZhU2NyaXB0VGV4dD9cblx0ICAgICAgICAgICAgY29uc3QgbW9kdWxlID0gbmV3IE1vZHVsZShpZCwgdGhpcyk7XG5cdCAgICAgICAgICAgIG1vZHVsZS5sb2FkKGlkLCBleHRlcm5hbENvbW1vbkpzQ29udGVudHMpO1xuXHQgICAgICAgICAgICByZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICAgIHJldHVybiBudWxsOyAvLyBmYWlsZWQgdG8gbG9hZFxuXHQgICAgfVxuXG5cdCAgICAvKipcblx0ICAgICAqIEF0dGVtcHRzIHRvIGxvYWQgYSBub2RlIG1vZHVsZSBieSBpZCBmcm9tIHRoZSBzdGFydGluZyBwYXRoXG5cdCAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IG1vZHVsZUlkICAgICAgIFRoZSBwYXRoIG9mIHRoZSBtb2R1bGUgdG8gbG9hZC5cblx0ICAgICAqIEBwYXJhbSAge3N0cmluZ1tdfSBkaXJzICAgICAgIHBhdGhzIHRvIHNlYXJjaFxuXHQgICAgICogQHJldHVybiB7TW9kdWxlfG51bGx9ICAgICAgVGhlIG1vZHVsZSwgaWYgbG9hZGVkLiBudWxsIGlmIG5vdC5cblx0ICAgICAqL1xuXHQgICAgbG9hZE5vZGVNb2R1bGVzKG1vZHVsZUlkLCBkaXJzKSB7XG5cdCAgICAgIC8vIDIuIGZvciBlYWNoIERJUiBpbiBESVJTOlxuXHQgICAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJzKSB7XG5cdCAgICAgICAgLy8gYS4gTE9BRF9BU19GSUxFKERJUi9YKVxuXHQgICAgICAgIC8vIGIuIExPQURfQVNfRElSRUNUT1JZKERJUi9YKVxuXHQgICAgICAgIGNvbnN0IG1vZCA9IHRoaXMubG9hZEFzRmlsZU9yRGlyZWN0b3J5KHBhdGguam9pbihkaXIsIG1vZHVsZUlkKSk7XG5cdCAgICAgICAgaWYgKG1vZCkge1xuXHQgICAgICAgICAgcmV0dXJuIG1vZDtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgICAgcmV0dXJuIG51bGw7XG5cdCAgICB9XG5cblx0ICAgIC8qKlxuXHQgICAgICogRGV0ZXJtaW5lIHRoZSBzZXQgb2YgcGF0aHMgdG8gc2VhcmNoIGZvciBub2RlX21vZHVsZXNcblx0ICAgICAqIEBwYXJhbSAge3N0cmluZ30gc3RhcnREaXIgICAgICAgVGhlIHN0YXJ0aW5nIGRpcmVjdG9yeVxuXHQgICAgICogQHJldHVybiB7c3RyaW5nW119ICAgICAgICAgICAgICBUaGUgYXJyYXkgb2YgcGF0aHMgdG8gc2VhcmNoXG5cdCAgICAgKi9cblx0ICAgIG5vZGVNb2R1bGVzUGF0aHMoc3RhcnREaXIpIHtcblx0ICAgICAgLy8gTWFrZSBzdXJlIHdlIGhhdmUgYW4gYWJzb2x1dGUgcGF0aCB0byBzdGFydCB3aXRoXG5cdCAgICAgIHN0YXJ0RGlyID0gcGF0aC5yZXNvbHZlKHN0YXJ0RGlyKTtcblxuXHQgICAgICAvLyBSZXR1cm4gZWFybHkgaWYgd2UgYXJlIGF0IHJvb3QsIHRoaXMgYXZvaWRzIGRvaW5nIGEgcG9pbnRsZXNzIGxvb3Bcblx0ICAgICAgLy8gYW5kIGFsc28gcmV0dXJuaW5nIGFuIGFycmF5IHdpdGggZHVwbGljYXRlIGVudHJpZXNcblx0ICAgICAgLy8gZS5nLiBbXCIvbm9kZV9tb2R1bGVzXCIsIFwiL25vZGVfbW9kdWxlc1wiXVxuXHQgICAgICBpZiAoc3RhcnREaXIgPT09ICcvJykge1xuXHQgICAgICAgIHJldHVybiBbJy9ub2RlX21vZHVsZXMnXTtcblx0ICAgICAgfVxuXHQgICAgICAvLyAxLiBsZXQgUEFSVFMgPSBwYXRoIHNwbGl0KFNUQVJUKVxuXHQgICAgICBjb25zdCBwYXJ0cyA9IHN0YXJ0RGlyLnNwbGl0KCcvJyk7XG5cdCAgICAgIC8vIDIuIGxldCBJID0gY291bnQgb2YgUEFSVFMgLSAxXG5cdCAgICAgIGxldCBpID0gcGFydHMubGVuZ3RoIC0gMTtcblx0ICAgICAgLy8gMy4gbGV0IERJUlMgPSBbXVxuXHQgICAgICBjb25zdCBkaXJzID0gW107XG5cblx0ICAgICAgLy8gNC4gd2hpbGUgSSA+PSAwLFxuXHQgICAgICB3aGlsZSAoaSA+PSAwKSB7XG5cdCAgICAgICAgLy8gYS4gaWYgUEFSVFNbSV0gPSBcIm5vZGVfbW9kdWxlc1wiIENPTlRJTlVFXG5cdCAgICAgICAgaWYgKHBhcnRzW2ldID09PSAnbm9kZV9tb2R1bGVzJyB8fCBwYXJ0c1tpXSA9PT0gJycpIHtcblx0ICAgICAgICAgIGkgLT0gMTtcblx0ICAgICAgICAgIGNvbnRpbnVlO1xuXHQgICAgICAgIH1cblx0ICAgICAgICAvLyBiLiBESVIgPSBwYXRoIGpvaW4oUEFSVFNbMCAuLiBJXSArIFwibm9kZV9tb2R1bGVzXCIpXG5cdCAgICAgICAgY29uc3QgZGlyID0gcGF0aC5qb2luKHBhcnRzLnNsaWNlKDAsIGkgKyAxKS5qb2luKCcvJyksICdub2RlX21vZHVsZXMnKTtcblx0ICAgICAgICAvLyBjLiBESVJTID0gRElSUyArIERJUlxuXHQgICAgICAgIGRpcnMucHVzaChkaXIpO1xuXHQgICAgICAgIC8vIGQuIGxldCBJID0gSSAtIDFcblx0ICAgICAgICBpIC09IDE7XG5cdCAgICAgIH1cblx0ICAgICAgLy8gQWx3YXlzIGFkZCAvbm9kZV9tb2R1bGVzIHRvIHRoZSBzZWFyY2ggcGF0aFxuXHQgICAgICBkaXJzLnB1c2goJy9ub2RlX21vZHVsZXMnKTtcblx0ICAgICAgcmV0dXJuIGRpcnM7XG5cdCAgICB9XG5cblx0ICAgIC8qKlxuXHQgICAgICogQXR0ZW1wdHMgdG8gbG9hZCBhIGdpdmVuIHBhdGggYXMgYSBmaWxlIG9yIGRpcmVjdG9yeS5cblx0ICAgICAqIEBwYXJhbSAge3N0cmluZ30gbm9ybWFsaXplZFBhdGggVGhlIHBhdGggb2YgdGhlIG1vZHVsZSB0byBsb2FkLlxuXHQgICAgICogQHJldHVybiB7TW9kdWxlfG51bGx9IFRoZSBsb2FkZWQgbW9kdWxlLiBudWxsIGlmIHVuYWJsZSB0byBsb2FkLlxuXHQgICAgICovXG5cdCAgICBsb2FkQXNGaWxlT3JEaXJlY3Rvcnkobm9ybWFsaXplZFBhdGgpIHtcblx0ICAgICAgLy8gYS4gTE9BRF9BU19GSUxFKFkgKyBYKVxuXHQgICAgICBsZXQgbG9hZGVkID0gdGhpcy5sb2FkQXNGaWxlKG5vcm1hbGl6ZWRQYXRoKTtcblx0ICAgICAgaWYgKGxvYWRlZCkge1xuXHQgICAgICAgIHJldHVybiBsb2FkZWQ7XG5cdCAgICAgIH1cblx0ICAgICAgLy8gYi4gTE9BRF9BU19ESVJFQ1RPUlkoWSArIFgpXG5cdCAgICAgIGxvYWRlZCA9IHRoaXMubG9hZEFzRGlyZWN0b3J5KG5vcm1hbGl6ZWRQYXRoKTtcblx0ICAgICAgaWYgKGxvYWRlZCkge1xuXHQgICAgICAgIHJldHVybiBsb2FkZWQ7XG5cdCAgICAgIH1cblx0ICAgICAgcmV0dXJuIG51bGw7XG5cdCAgICB9XG5cblx0ICAgIC8qKlxuXHQgICAgICogTG9hZHMgYSBnaXZlbiBmaWxlIGFzIGEgSmF2YXNjcmlwdCBmaWxlLCByZXR1cm5pbmcgdGhlIG1vZHVsZS5leHBvcnRzLlxuXHQgICAgICogQHBhcmFtICB7c3RyaW5nfSBmaWxlbmFtZSBGaWxlIHdlJ3JlIGF0dGVtcHRpbmcgdG8gbG9hZFxuXHQgICAgICogQHJldHVybiB7TW9kdWxlfSB0aGUgbG9hZGVkIG1vZHVsZVxuXHQgICAgICovXG5cdCAgICBsb2FkSmF2YXNjcmlwdFRleHQoZmlsZW5hbWUpIHtcblx0ICAgICAgLy8gTG9vayBpbiB0aGUgY2FjaGUhXG5cdCAgICAgIGlmIChNb2R1bGUuY2FjaGVbZmlsZW5hbWVdKSB7XG5cdCAgICAgICAgcmV0dXJuIE1vZHVsZS5jYWNoZVtmaWxlbmFtZV07XG5cdCAgICAgIH1cblx0ICAgICAgY29uc3QgbW9kdWxlID0gbmV3IE1vZHVsZShmaWxlbmFtZSwgdGhpcyk7XG5cdCAgICAgIG1vZHVsZS5sb2FkKGZpbGVuYW1lKTtcblx0ICAgICAgcmV0dXJuIG1vZHVsZTtcblx0ICAgIH1cblxuXHQgICAgLyoqXG5cdCAgICAgKiBMb2FkcyBhIEpTT04gZmlsZSBieSByZWFkaW5nIGl0J3MgY29udGVudHMsIGRvaW5nIGEgSlNPTi5wYXJzZSBhbmQgcmV0dXJuaW5nIHRoZSBwYXJzZWQgb2JqZWN0LlxuXHQgICAgICpcblx0ICAgICAqIEBwYXJhbSAge1N0cmluZ30gZmlsZW5hbWUgRmlsZSB3ZSdyZSBhdHRlbXB0aW5nIHRvIGxvYWRcblx0ICAgICAqIEByZXR1cm4ge01vZHVsZX0gVGhlIGxvYWRlZCBtb2R1bGUgaW5zdGFuY2Vcblx0ICAgICAqL1xuXHQgICAgbG9hZEphdmFzY3JpcHRPYmplY3QoZmlsZW5hbWUpIHtcblx0ICAgICAgLy8gTG9vayBpbiB0aGUgY2FjaGUhXG5cdCAgICAgIGlmIChNb2R1bGUuY2FjaGVbZmlsZW5hbWVdKSB7XG5cdCAgICAgICAgcmV0dXJuIE1vZHVsZS5jYWNoZVtmaWxlbmFtZV07XG5cdCAgICAgIH1cblx0ICAgICAgY29uc3QgbW9kdWxlID0gbmV3IE1vZHVsZShmaWxlbmFtZSwgdGhpcyk7XG5cdCAgICAgIG1vZHVsZS5maWxlbmFtZSA9IGZpbGVuYW1lO1xuXHQgICAgICBtb2R1bGUucGF0aCA9IHBhdGguZGlybmFtZShmaWxlbmFtZSk7XG5cdCAgICAgIGNvbnN0IHNvdXJjZSA9IGFzc2V0cy5yZWFkQXNzZXQoZmlsZW5hbWUpO1xuXG5cdCAgICAgIC8vIFN0aWNrIGl0IGluIHRoZSBjYWNoZVxuXHQgICAgICBNb2R1bGUuY2FjaGVbZmlsZW5hbWVdID0gbW9kdWxlO1xuXHQgICAgICBtb2R1bGUuZXhwb3J0cyA9IEpTT04ucGFyc2Uoc291cmNlKTtcblx0ICAgICAgbW9kdWxlLmxvYWRlZCA9IHRydWU7XG5cdCAgICAgIHJldHVybiBtb2R1bGU7XG5cdCAgICB9XG5cblx0ICAgIC8qKlxuXHQgICAgICogQXR0ZW1wdHMgdG8gbG9hZCBhIGZpbGUgYnkgaXQncyBmdWxsIGZpbGVuYW1lIGFjY29yZGluZyB0byBOb2RlSlMgcnVsZXMuXG5cdCAgICAgKlxuXHQgICAgICogQHBhcmFtICB7c3RyaW5nfSBpZCBUaGUgZmlsZW5hbWVcblx0ICAgICAqIEByZXR1cm4ge01vZHVsZXxudWxsfSBNb2R1bGUgaW5zdGFuY2UgaWYgbG9hZGVkLCBudWxsIGlmIG5vdCBmb3VuZC5cblx0ICAgICAqL1xuXHQgICAgbG9hZEFzRmlsZShpZCkge1xuXHQgICAgICAvLyAxLiBJZiBYIGlzIGEgZmlsZSwgbG9hZCBYIGFzIEphdmFTY3JpcHQgdGV4dC4gIFNUT1Bcblx0ICAgICAgbGV0IGZpbGVuYW1lID0gaWQ7XG5cdCAgICAgIGlmICh0aGlzLmZpbGVuYW1lRXhpc3RzKGZpbGVuYW1lKSkge1xuXHQgICAgICAgIC8vIElmIHRoZSBmaWxlIGhhcyBhIC5qc29uIGV4dGVuc2lvbiwgbG9hZCBhcyBKYXZhc2NyaXB0T2JqZWN0XG5cdCAgICAgICAgaWYgKGZpbGVuYW1lLmxlbmd0aCA+IDUgJiYgZmlsZW5hbWUuc2xpY2UoLTQpID09PSAnanNvbicpIHtcblx0ICAgICAgICAgIHJldHVybiB0aGlzLmxvYWRKYXZhc2NyaXB0T2JqZWN0KGZpbGVuYW1lKTtcblx0ICAgICAgICB9XG5cdCAgICAgICAgcmV0dXJuIHRoaXMubG9hZEphdmFzY3JpcHRUZXh0KGZpbGVuYW1lKTtcblx0ICAgICAgfVxuXHQgICAgICAvLyAyLiBJZiBYLmpzIGlzIGEgZmlsZSwgbG9hZCBYLmpzIGFzIEphdmFTY3JpcHQgdGV4dC4gIFNUT1Bcblx0ICAgICAgZmlsZW5hbWUgPSBpZCArICcuanMnO1xuXHQgICAgICBpZiAodGhpcy5maWxlbmFtZUV4aXN0cyhmaWxlbmFtZSkpIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy5sb2FkSmF2YXNjcmlwdFRleHQoZmlsZW5hbWUpO1xuXHQgICAgICB9XG5cdCAgICAgIC8vIDMuIElmIFguanNvbiBpcyBhIGZpbGUsIHBhcnNlIFguanNvbiB0byBhIEphdmFTY3JpcHQgT2JqZWN0LiAgU1RPUFxuXHQgICAgICBmaWxlbmFtZSA9IGlkICsgJy5qc29uJztcblx0ICAgICAgaWYgKHRoaXMuZmlsZW5hbWVFeGlzdHMoZmlsZW5hbWUpKSB7XG5cdCAgICAgICAgcmV0dXJuIHRoaXMubG9hZEphdmFzY3JpcHRPYmplY3QoZmlsZW5hbWUpO1xuXHQgICAgICB9XG5cdCAgICAgIC8vIGZhaWxlZCB0byBsb2FkIGFueXRoaW5nIVxuXHQgICAgICByZXR1cm4gbnVsbDtcblx0ICAgIH1cblxuXHQgICAgLyoqXG5cdCAgICAgKiBBdHRlbXB0cyB0byBsb2FkIGEgZGlyZWN0b3J5IGFjY29yZGluZyB0byBOb2RlSlMgcnVsZXMuXG5cdCAgICAgKlxuXHQgICAgICogQHBhcmFtICB7c3RyaW5nfSBpZCBUaGUgZGlyZWN0b3J5IG5hbWVcblx0ICAgICAqIEByZXR1cm4ge01vZHVsZXxudWxsfSBMb2FkZWQgbW9kdWxlLCBudWxsIGlmIG5vdCBmb3VuZC5cblx0ICAgICAqL1xuXHQgICAgbG9hZEFzRGlyZWN0b3J5KGlkKSB7XG5cdCAgICAgIC8vIDEuIElmIFgvcGFja2FnZS5qc29uIGlzIGEgZmlsZSxcblx0ICAgICAgbGV0IGZpbGVuYW1lID0gcGF0aC5yZXNvbHZlKGlkLCAncGFja2FnZS5qc29uJyk7XG5cdCAgICAgIGlmICh0aGlzLmZpbGVuYW1lRXhpc3RzKGZpbGVuYW1lKSkge1xuXHQgICAgICAgIC8vIGEuIFBhcnNlIFgvcGFja2FnZS5qc29uLCBhbmQgbG9vayBmb3IgXCJtYWluXCIgZmllbGQuXG5cdCAgICAgICAgY29uc3Qgb2JqZWN0ID0gdGhpcy5sb2FkSmF2YXNjcmlwdE9iamVjdChmaWxlbmFtZSk7XG5cdCAgICAgICAgaWYgKG9iamVjdCAmJiBvYmplY3QuZXhwb3J0cyAmJiBvYmplY3QuZXhwb3J0cy5tYWluKSB7XG5cdCAgICAgICAgICAvLyBiLiBsZXQgTSA9IFggKyAoanNvbiBtYWluIGZpZWxkKVxuXHQgICAgICAgICAgY29uc3QgbSA9IHBhdGgucmVzb2x2ZShpZCwgb2JqZWN0LmV4cG9ydHMubWFpbik7XG5cdCAgICAgICAgICAvLyBjLiBMT0FEX0FTX0ZJTEUoTSlcblx0ICAgICAgICAgIHJldHVybiB0aGlzLmxvYWRBc0ZpbGVPckRpcmVjdG9yeShtKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICAvLyAyLiBJZiBYL2luZGV4LmpzIGlzIGEgZmlsZSwgbG9hZCBYL2luZGV4LmpzIGFzIEphdmFTY3JpcHQgdGV4dC4gIFNUT1Bcblx0ICAgICAgZmlsZW5hbWUgPSBwYXRoLnJlc29sdmUoaWQsICdpbmRleC5qcycpO1xuXHQgICAgICBpZiAodGhpcy5maWxlbmFtZUV4aXN0cyhmaWxlbmFtZSkpIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy5sb2FkSmF2YXNjcmlwdFRleHQoZmlsZW5hbWUpO1xuXHQgICAgICB9XG5cdCAgICAgIC8vIDMuIElmIFgvaW5kZXguanNvbiBpcyBhIGZpbGUsIHBhcnNlIFgvaW5kZXguanNvbiB0byBhIEphdmFTY3JpcHQgb2JqZWN0LiBTVE9QXG5cdCAgICAgIGZpbGVuYW1lID0gcGF0aC5yZXNvbHZlKGlkLCAnaW5kZXguanNvbicpO1xuXHQgICAgICBpZiAodGhpcy5maWxlbmFtZUV4aXN0cyhmaWxlbmFtZSkpIHtcblx0ICAgICAgICByZXR1cm4gdGhpcy5sb2FkSmF2YXNjcmlwdE9iamVjdChmaWxlbmFtZSk7XG5cdCAgICAgIH1cblx0ICAgICAgcmV0dXJuIG51bGw7XG5cdCAgICB9XG5cblx0ICAgIC8qKlxuXHQgICAgICogU2V0dXAgYSBzYW5kYm94IGFuZCBydW4gdGhlIG1vZHVsZSdzIHNjcmlwdCBpbnNpZGUgaXQuXG5cdCAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgdGhlIGV4ZWN1dGVkIHNjcmlwdC5cblx0ICAgICAqIEBwYXJhbSAge1N0cmluZ30gc291cmNlICAgW2Rlc2NyaXB0aW9uXVxuXHQgICAgICogQHBhcmFtICB7U3RyaW5nfSBmaWxlbmFtZSBbZGVzY3JpcHRpb25dXG5cdCAgICAgKiBAcmV0dXJuIHsqfSAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAgICAgKi9cblx0ICAgIF9ydW5TY3JpcHQoc291cmNlLCBmaWxlbmFtZSkge1xuXHQgICAgICBjb25zdCBzZWxmID0gdGhpcztcblx0ICAgICAgZnVuY3Rpb24gcmVxdWlyZShwYXRoKSB7XG5cdCAgICAgICAgcmV0dXJuIHNlbGYucmVxdWlyZShwYXRoKTtcblx0ICAgICAgfVxuXHQgICAgICByZXF1aXJlLm1haW4gPSBNb2R1bGUubWFpbjtcblxuXHQgICAgICAvLyBUaGlzIFwiZmlyc3QgdGltZVwiIHJ1biBpcyByZWFsbHkgb25seSBmb3IgYXBwLmpzLCBBRkFJQ1QsIGFuZCBuZWVkc1xuXHQgICAgICAvLyBhbiBhY3Rpdml0eS4gSWYgYXBwIHdhcyByZXN0YXJ0ZWQgZm9yIFNlcnZpY2Ugb25seSwgd2UgZG9uJ3Qgd2FudFxuXHQgICAgICAvLyB0byBnbyB0aGlzIHJvdXRlLiBTbyBhZGRlZCBjdXJyZW50QWN0aXZpdHkgY2hlY2suIChiaWxsKVxuXHQgICAgICBpZiAoc2VsZi5pZCA9PT0gJy4nICYmICF0aGlzLmlzU2VydmljZSkge1xuXHQgICAgICAgIGdsb2JhbC5yZXF1aXJlID0gcmVxdWlyZTtcblxuXHQgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgYW4gaW5zcGVjdG9yIGJpbmRpbmcuLi5cblx0ICAgICAgICBjb25zdCBpbnNwZWN0b3IgPSBrcm9sbC5iaW5kaW5nKCdpbnNwZWN0b3InKTtcblx0ICAgICAgICBpZiAoaW5zcGVjdG9yKSB7XG5cdCAgICAgICAgICAvLyBJZiBkZWJ1Z2dlciBpcyBlbmFibGVkLCBsb2FkIGFwcC5qcyBhbmQgcGF1c2UgcmlnaHQgYmVmb3JlIHdlIGV4ZWN1dGUgaXRcblx0ICAgICAgICAgIGNvbnN0IGluc3BlY3RvcldyYXBwZXIgPSBpbnNwZWN0b3IuY2FsbEFuZFBhdXNlT25TdGFydDtcblx0ICAgICAgICAgIGlmIChpbnNwZWN0b3JXcmFwcGVyKSB7XG5cdCAgICAgICAgICAgIC8vIEZJWE1FIFdoeSBjYW4ndCB3ZSBkbyBub3JtYWwgTW9kdWxlLndyYXAoc291cmNlKSBoZXJlP1xuXHQgICAgICAgICAgICAvLyBJIGdldCBcIlVuY2F1Z2h0IFR5cGVFcnJvcjogQ2Fubm90IHJlYWQgcHJvcGVydHkgJ2NyZWF0ZVRhYkdyb3VwJyBvZiB1bmRlZmluZWRcIiBmb3IgXCJUaS5VSS5jcmVhdGVUYWJHcm91cCgpO1wiXG5cdCAgICAgICAgICAgIC8vIE5vdCBzdXJlIHdoeSBhcHAuanMgaXMgc3BlY2lhbCBjYXNlIGFuZCBjYW4ndCBiZSBydW4gdW5kZXIgbm9ybWFsIHNlbGYtaW52b2tpbmcgd3JhcHBpbmcgZnVuY3Rpb24gdGhhdCBnZXRzIHBhc3NlZCBpbiBnbG9iYWwva3JvbGwvVGkvZXRjXG5cdCAgICAgICAgICAgIC8vIEluc3RlYWQsIGxldCdzIHVzZSBhIHNsaWdodGx5IG1vZGlmaWVkIHZlcnNpb24gb2YgY2FsbEFuZFBhdXNlT25TdGFydDpcblx0ICAgICAgICAgICAgLy8gSXQgd2lsbCBjb21waWxlIHRoZSBzb3VyY2UgYXMtaXMsIHNjaGVkdWxlIGEgcGF1c2UgYW5kIHRoZW4gcnVuIHRoZSBzb3VyY2UuXG5cdCAgICAgICAgICAgIHJldHVybiBpbnNwZWN0b3JXcmFwcGVyKHNvdXJjZSwgZmlsZW5hbWUpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblx0ICAgICAgICAvLyBydW4gYXBwLmpzIFwibm9ybWFsbHlcIiAoaS5lLiBub3QgdW5kZXIgZGVidWdnZXIvaW5zcGVjdG9yKVxuXHQgICAgICAgIHJldHVybiBTY3JpcHQucnVuSW5UaGlzQ29udGV4dChzb3VyY2UsIGZpbGVuYW1lLCB0cnVlKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIC8vIEluIFY4LCB3ZSB0cmVhdCBleHRlcm5hbCBtb2R1bGVzIHRoZSBzYW1lIGFzIG5hdGl2ZSBtb2R1bGVzLiAgRmlyc3QsIHdlIHdyYXAgdGhlXG5cdCAgICAgIC8vIG1vZHVsZSBjb2RlIGFuZCB0aGVuIHJ1biBpdCBpbiB0aGUgY3VycmVudCBjb250ZXh0LiAgVGhpcyB3aWxsIGFsbG93IGV4dGVybmFsIG1vZHVsZXMgdG9cblx0ICAgICAgLy8gYWNjZXNzIGdsb2JhbHMgYXMgbWVudGlvbmVkIGluIFRJTU9CLTExNzUyLiBUaGlzIHdpbGwgYWxzbyBoZWxwIHJlc29sdmUgc3RhcnR1cCBzbG93bmVzcyB0aGF0XG5cdCAgICAgIC8vIG9jY3VycyBhcyBhIHJlc3VsdCBvZiBjcmVhdGluZyBhIG5ldyBjb250ZXh0IGR1cmluZyBzdGFydHVwIGluIFRJTU9CLTEyMjg2LlxuXHQgICAgICBzb3VyY2UgPSBNb2R1bGUud3JhcChzb3VyY2UpO1xuXHQgICAgICBjb25zdCBmID0gU2NyaXB0LnJ1bkluVGhpc0NvbnRleHQoc291cmNlLCBmaWxlbmFtZSwgdHJ1ZSk7XG5cdCAgICAgIHJldHVybiBmKHRoaXMuZXhwb3J0cywgcmVxdWlyZSwgdGhpcywgZmlsZW5hbWUsIHBhdGguZGlybmFtZShmaWxlbmFtZSksIFRpdGFuaXVtLCBUaSwgZ2xvYmFsLCBrcm9sbCk7XG5cdCAgICB9XG5cblx0ICAgIC8qKlxuXHQgICAgICogTG9vayB1cCBhIGZpbGVuYW1lIGluIHRoZSBhcHAncyBpbmRleC5qc29uIGZpbGVcblx0ICAgICAqIEBwYXJhbSAge1N0cmluZ30gZmlsZW5hbWUgdGhlIGZpbGUgd2UncmUgbG9va2luZyBmb3Jcblx0ICAgICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICAgdHJ1ZSBpZiB0aGUgZmlsZW5hbWUgZXhpc3RzIGluIHRoZSBpbmRleC5qc29uXG5cdCAgICAgKi9cblx0ICAgIGZpbGVuYW1lRXhpc3RzKGZpbGVuYW1lKSB7XG5cdCAgICAgIGZpbGVuYW1lID0gJ1Jlc291cmNlcycgKyBmaWxlbmFtZTsgLy8gV2hlbiB3ZSBhY3R1YWxseSBsb29rIGZvciBmaWxlcywgYXNzdW1lIFwiUmVzb3VyY2VzL1wiIGlzIHRoZSByb290XG5cdCAgICAgIGlmICghZmlsZUluZGV4KSB7XG5cdCAgICAgICAgY29uc3QganNvbiA9IGFzc2V0cy5yZWFkQXNzZXQoSU5ERVhfSlNPTik7XG5cdCAgICAgICAgZmlsZUluZGV4ID0gSlNPTi5wYXJzZShqc29uKTtcblx0ICAgICAgfVxuXHQgICAgICByZXR1cm4gZmlsZUluZGV4ICYmIGZpbGVuYW1lIGluIGZpbGVJbmRleDtcblx0ICAgIH1cblx0ICB9XG5cdCAgTW9kdWxlLmNhY2hlID0gW107XG5cdCAgTW9kdWxlLm1haW4gPSBudWxsO1xuXHQgIE1vZHVsZS53cmFwcGVyID0gWycoZnVuY3Rpb24gKGV4cG9ydHMsIHJlcXVpcmUsIG1vZHVsZSwgX19maWxlbmFtZSwgX19kaXJuYW1lLCBUaXRhbml1bSwgVGksIGdsb2JhbCwga3JvbGwpIHsnLCAnXFxufSk7J107XG5cdCAgTW9kdWxlLndyYXAgPSBmdW5jdGlvbiAoc2NyaXB0KSB7XG5cdCAgICByZXR1cm4gTW9kdWxlLndyYXBwZXJbMF0gKyBzY3JpcHQgKyBNb2R1bGUud3JhcHBlclsxXTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogW3J1bk1vZHVsZSBkZXNjcmlwdGlvbl1cblx0ICAgKiBAcGFyYW0gIHtTdHJpbmd9IHNvdXJjZSAgICAgICAgICAgIEpTIFNvdXJjZSBjb2RlXG5cdCAgICogQHBhcmFtICB7U3RyaW5nfSBmaWxlbmFtZSAgICAgICAgICBGaWxlbmFtZSBvZiB0aGUgbW9kdWxlXG5cdCAgICogQHBhcmFtICB7VGl0YW5pdW0uU2VydmljZXxudWxsfFRpdGFuaXVtLkFuZHJvaWQuQWN0aXZpdHl9IGFjdGl2aXR5T3JTZXJ2aWNlIFtkZXNjcmlwdGlvbl1cblx0ICAgKiBAcmV0dXJuIHtNb2R1bGV9ICAgICAgICAgICAgICAgICAgIFRoZSBsb2FkZWQgTW9kdWxlXG5cdCAgICovXG5cdCAgTW9kdWxlLnJ1bk1vZHVsZSA9IGZ1bmN0aW9uIChzb3VyY2UsIGZpbGVuYW1lLCBhY3Rpdml0eU9yU2VydmljZSkge1xuXHQgICAgbGV0IGlkID0gZmlsZW5hbWU7XG5cdCAgICBpZiAoIU1vZHVsZS5tYWluKSB7XG5cdCAgICAgIGlkID0gJy4nO1xuXHQgICAgfVxuXHQgICAgY29uc3QgbW9kdWxlID0gbmV3IE1vZHVsZShpZCwgbnVsbCk7XG5cdCAgICAvLyBGSVhNRTogSSBkb24ndCBrbm93IHdoeSBpbnN0YW5jZW9mIGZvciBUaXRhbml1bS5TZXJ2aWNlIHdvcmtzIGhlcmUhXG5cdCAgICAvLyBPbiBBbmRyb2lkLCBpdCdzIGFuIGFwaW5hbWUgb2YgVGkuQW5kcm9pZC5TZXJ2aWNlXG5cdCAgICAvLyBPbiBpT1MsIHdlIGRvbid0IHlldCBwYXNzIGluIHRoZSB2YWx1ZSwgYnV0IHdlIGRvIHNldCBUaS5BcHAuY3VycmVudFNlcnZpY2UgcHJvcGVydHkgYmVmb3JlaGFuZCFcblx0ICAgIC8vIENhbiB3ZSByZW1vdmUgdGhlIHByZWxvYWQgc3R1ZmYgaW4gS3JvbGxCcmlkZ2UubSB0byBwYXNzIGFsb25nIHRoZSBzZXJ2aWNlIGluc3RhbmNlIGludG8gdGhpcyBsaWtlIHdlIGRvIG9uIEFuZG9yaWQ/XG5cdCAgICBtb2R1bGUuaXNTZXJ2aWNlID0gVGkuQXBwLmN1cnJlbnRTZXJ2aWNlICE9PSBudWxsO1xuXHQgICAgaWYgKCFNb2R1bGUubWFpbikge1xuXHQgICAgICBNb2R1bGUubWFpbiA9IG1vZHVsZTtcblx0ICAgIH1cblx0ICAgIGZpbGVuYW1lID0gZmlsZW5hbWUucmVwbGFjZSgnUmVzb3VyY2VzLycsICcvJyk7IC8vIG5vcm1hbGl6ZSBiYWNrIHRvIGFic29sdXRlIHBhdGhzICh3aGljaCByZWFsbHkgYXJlIHJlbGF0aXZlIHRvIFJlc291cmNlcyB1bmRlciB0aGUgaG9vZClcblx0ICAgIG1vZHVsZS5sb2FkKGZpbGVuYW1lLCBzb3VyY2UpO1xuXHQgICAgcmV0dXJuIG1vZHVsZTtcblx0ICB9O1xuXHQgIHJldHVybiBNb2R1bGU7XG5cdH1cblxuXHQvKiBnbG9iYWxzIE9TX0FORFJPSUQsT1NfSU9TICovXG5cdGZ1bmN0aW9uIGJvb3RzdHJhcCQxKGdsb2JhbCwga3JvbGwpIHtcblx0ICB7XG5cdCAgICAvLyBPbiBpT1MsIHJlYWxseSB3ZSBqdXN0IG5lZWQgdG8gc2V0IHVwIHRoZSBUb3BUaU1vZHVsZSBiaW5kaW5nIHN0dWZmLCB0aGVuIGhhbmcgbGF6eSBwcm9wZXJ0eSBnZXR0ZXJzIGZvciB0aGUgdG9wLWxldmVsIG1vZHVsZXMgbGlrZSBVSSwgQVBJLCBldGNcblx0ICAgIGNvbnN0IFRpID0ga3JvbGwuYmluZGluZygndG9wVGknKTtcblx0ICAgIGNvbnN0IG1vZHVsZXMgPSBbJ0FjY2VsZXJvbWV0ZXInLCAnQW5hbHl0aWNzJywgJ0FwcCcsICdBUEknLCAnQ2FsZW5kYXInLCAnQ29kZWMnLCAnQ29udGFjdHMnLCAnRGF0YWJhc2UnLCAnRmlsZXN5c3RlbScsICdHZW9sb2NhdGlvbicsICdHZXN0dXJlJywgJ0xvY2FsZScsICdNZWRpYScsICdOZXR3b3JrJywgJ1BsYXRmb3JtJywgJ1N0cmVhbScsICdVdGlscycsICdVSScsICdXYXRjaFNlc3Npb24nLCAnWE1MJ107XG5cdCAgICBmb3IgKGNvbnN0IG1vZE5hbWUgb2YgbW9kdWxlcykge1xuXHQgICAgICAvLyBUaGlzIG1ha2VzIHRoZSBuYW1lc3BhY2UgXCJsYXp5XCIgLSB3ZSBpbnN0YW50aWF0ZSBpdCBvbiBkZW1hbmQgYW5kIHRoZW5cblx0ICAgICAgLy8gcmVwbGFjZSB0aGUgbGF6eSBpbml0IHdpdGggc3RyYWlnaHQgcHJvcGVydHkgdmFsdWUgd2hlbiBkb25lXG5cdCAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShUaSwgbW9kTmFtZSwge1xuXHQgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0ICAgICAgICAvLyBtdXN0IGJlIGNvbmZpZ3VyYWJsZSB0byBiZSBhYmxlIHRvIGNoYW5nZSB0aGUgcHJvcGVydHkgdG8gc3RhdGljIHZhbHVlIGFmdGVyIGFjY2Vzc1xuXHQgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuXHQgICAgICAgIC8vIHdyaXRhYmxlOiB0cnVlLCAvLyBjYW5ub3Qgc3BlY2lmeSB3cml0YWJsZSB3aXRoIGEgZ2V0dGVyXG5cdCAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICBjb25zdCByZWFsTW9kdWxlID0ga3JvbGwuYmluZGluZyhtb2ROYW1lKTtcblx0ICAgICAgICAgIC8vIE5vdyByZXBsYWNlIG91ciBsYXp5IGdldHRlciBvbiB0aGUgcHJvcGVydHkgd2l0aCBhIHZhbHVlXG5cdCAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoVGksIG1vZE5hbWUsIHtcblx0ICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcblx0ICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG5cdCAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcblx0ICAgICAgICAgICAgdmFsdWU6IHJlYWxNb2R1bGVcblx0ICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgcmV0dXJuIHJlYWxNb2R1bGU7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBUaTtcblx0ICB9XG5cdH1cblxuXHQvLyBUaGlzIGlzIHRoZSBmaWxlIGVhY2ggcGxhdGZvcm0gbG9hZHMgb24gYm9vdCAqYmVmb3JlKiB3ZSBsYXVuY2ggdGkubWFpbi5qcyB0byBpbnNlcnQgYWxsIG91ciBzaGltcy9leHRlbnNpb25zXG5cblx0LyoqXG5cdCAqIG1haW4gYm9vdHN0cmFwcGluZyBmdW5jdGlvblxuXHQgKiBAcGFyYW0ge29iamVjdH0gZ2xvYmFsIHRoZSBnbG9iYWwgb2JqZWN0XG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBrcm9sbDsgdGhlIGtyb2xsIG1vZHVsZS9iaW5kaW5nXG5cdCAqIEByZXR1cm4ge3ZvaWR9ICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGZ1bmN0aW9uIGJvb3RzdHJhcChnbG9iYWwsIGtyb2xsKSB7XG5cdCAgLy8gV29ya3MgaWRlbnRpY2FsIHRvIE9iamVjdC5oYXNPd25Qcm9wZXJ0eSwgZXhjZXB0XG5cdCAgLy8gYWxzbyB3b3JrcyBpZiB0aGUgZ2l2ZW4gb2JqZWN0IGRvZXMgbm90IGhhdmUgdGhlIG1ldGhvZFxuXHQgIC8vIG9uIGl0cyBwcm90b3R5cGUgb3IgaXQgaGFzIGJlZW4gbWFza2VkLlxuXHQgIGZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iamVjdCwgcHJvcGVydHkpIHtcblx0ICAgIHJldHVybiBPYmplY3QuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIHByb3BlcnR5KTtcblx0ICB9XG5cdCAga3JvbGwuZXh0ZW5kID0gZnVuY3Rpb24gKHRoaXNPYmplY3QsIG90aGVyT2JqZWN0KSB7XG5cdCAgICBpZiAoIW90aGVyT2JqZWN0KSB7XG5cdCAgICAgIC8vIGV4dGVuZCB3aXRoIHdoYXQ/ISAgZGVuaWVkIVxuXHQgICAgICByZXR1cm47XG5cdCAgICB9XG5cdCAgICBmb3IgKHZhciBuYW1lIGluIG90aGVyT2JqZWN0KSB7XG5cdCAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eShvdGhlck9iamVjdCwgbmFtZSkpIHtcblx0ICAgICAgICB0aGlzT2JqZWN0W25hbWVdID0gb3RoZXJPYmplY3RbbmFtZV07XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIHJldHVybiB0aGlzT2JqZWN0O1xuXHQgIH07XG5cdCAgZnVuY3Rpb24gc3RhcnR1cCgpIHtcblx0ICAgIGdsb2JhbC5nbG9iYWwgPSBnbG9iYWw7IC8vIGhhbmcgdGhlIGdsb2JhbCBvYmplY3Qgb2ZmIGl0c2VsZlxuXHQgICAgZ2xvYmFsLmtyb2xsID0ga3JvbGw7IC8vIGhhbmcgb3VyIHNwZWNpYWwgdW5kZXIgdGhlIGhvb2Qga3JvbGwgb2JqZWN0IG9mZiB0aGUgZ2xvYmFsXG5cdCAgICB7XG5cdCAgICAgIC8vIHJvdXRlIGtyb2xsLmV4dGVybmFsQmluZGluZyB0byBzYW1lIGltcGwgYXMgYmluZGluZyAtIHdlIHRyZWF0IDFzdCBhbmQgM3JkIHBhcnR5IG5hdGl2ZSBtb2R1bGVzIHRoZSBzYW1lXG5cdCAgICAgIGtyb2xsLmV4dGVybmFsQmluZGluZyA9IGtyb2xsLmJpbmRpbmc7XG5cdCAgICB9XG5cdCAgICBnbG9iYWwuVGkgPSBnbG9iYWwuVGl0YW5pdW0gPSBib290c3RyYXAkMShnbG9iYWwsIGtyb2xsKTtcblx0ICAgIGdsb2JhbC5Nb2R1bGUgPSBib290c3RyYXAkMihnbG9iYWwsIGtyb2xsKTtcblx0ICB9XG5cdCAgc3RhcnR1cCgpO1xuXHR9XG5cblx0cmV0dXJuIGJvb3RzdHJhcDtcblxufSkoKTtcbiJdLCJ2ZXJzaW9uIjozfQ==
