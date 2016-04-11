'use strict';

const path = require('./fastpath');

class Package {

  constructor({ file, fastfs, cache }) {
    this.path = file;
    this.root = path.dirname(this.path);
    this._fastfs = fastfs;
    this.type = 'Package';
    this._cache = cache;
  }

  getMain() {
    return this.read().then(json => {
      let main = json.main || 'index';
      var replacements = getReplacements(json);
      var replacement = this.getReplacement(main, replacements);
      // find a possible replacement
      if (replacement !== undefined) {
        main = replacement;
      }
      return path.join(this.root, main);
    });
  }

  getReplacement(name, replacements) {
    if (typeof replacements !== 'object') {
      return name;
    }
    // cut of the extension, if any
    const nameWithoutExt = name.replace(/(\.js|\.json)$/, '');
    const relPathWithoutExt = './' + path.relative(this.root, nameWithoutExt);
    const checks = [
      replacements[nameWithoutExt],
      replacements[nameWithoutExt + '.js'],
      replacements[nameWithoutExt + '.json'],
      replacements[relPathWithoutExt],
      replacements[relPathWithoutExt + '.js'],
      replacements[relPathWithoutExt + '.json'],
    ];
    for (let i = 0; i < checks.length; i++) {
      if (checks[i] !== undefined) {
        return checks[i];
      }
    }
    return undefined;
  }

  isHaste() {
    return this._cache.get(this.path, 'package-haste', () =>
      this.read().then(json => !!json.name)
    );
  }

  getName() {
    return this._cache.get(this.path, 'package-name', () =>
      this.read().then(json => json.name)
    );
  }

  invalidate() {
    this._cache.invalidate(this.path);
  }

  redirectRequire(name) {
    return Promise.all([
      this.read(),
      this.readProjectJson(),
    ])
    .then(([json, projectJson]) => {
      const globalReplacements = projectJson['global-react-native'] || {};
      const replacements = getReplacements(json);
      const allReplacements = { ...globalReplacements, ...replacements };
      const replacement = this.getReplacement(name, allReplacements);

      if (replacement === false) {
        return false;
      }

      if (replacement === undefined) {
        return name;
      }

      // replacement is other module (or absolute path?)
      if (replacement[0] !== '.') {
        return replacement;
      }

      return path.join(this.root, replacement);
    });
  }

  read() {
    if (!this._reading) {
      this._reading = this._fastfs.readFile(this.path)
        .then(jsonStr => JSON.parse(jsonStr));
    }

    return this._reading;
  }

  readProjectJson() {
    if (!this._readingProjectJson) {
      this._readingProjectJson = this._fastfs.readFile('./package.json')
        .then(jsonStr => JSON.parse(jsonStr));
    }

    return this._readingProjectJson;
  }
}

function getReplacements(pkg) {
  let browser = pkg.browser || {};
  let rn = pkg['react-native'] || {};
  if (typeof browser === 'string') {
    browser = { [pkg.main || 'index']: browser };
  }
  if (typeof rn === 'string') {
    rn = { [pkg.main || 'index']: rn };
  }
  return { ...browser, ...rn };
}

module.exports = Package;
