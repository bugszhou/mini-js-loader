'use strict';
const esprima = require('esprima'),
  estraverse = require('estraverse'),
  escodegen = require('escodegen');

Object.defineProperty(exports, "__esModule", {
  value: true
});
const path = require("path"),
  loaderUtils = require("loader-utils");

function miniJsLoader(source) {
  const requireReg = /require\([\"|\']([^\"]*?)[\"|\']\)/gi;
  let result = [],
    importArr = [];
  while (result = requireReg.exec(source)) {
    importArr.push(result[1]);
  }

  const options = loaderUtils.getOptions(this) || {};

  const context = options.context || this.rootContext;

  const url = loaderUtils.interpolateName(this, path.join(getRequireDir(this.resourcePath), options.filename), {
    context,
    source,
    regExp: options.regExp,
  });

  let outputPath = url;

  if (options.outputPath) {
    if (typeof options.outputPath === 'function') {
      outputPath = options.outputPath(url, this.resourcePath, context);
    } else {
      outputPath = path.posix.join(options.outputPath, url);
    }
  }

  if (typeof options.emitFile === 'undefined' || options.emitFile) {
    this.emitFile(outputPath, setJSMinify(source));
  }
  return getRequire(this.resourcePath, importArr);
};

function getRequire(resourcePath, importArr = []) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  let str = '';
  importArr.forEach(importUrl => {
    let isRootUrl = importUrl.indexOf('\/') === 0,
      sourceUrl = path.join(srcDir, importUrl);
    if (!isRootUrl) {
      sourceUrl = path.resolve(fileDir, importUrl);
    }
    str += `require('./${path.relative(fileDir, sourceUrl).split(path.sep).join('/')}');`
  });
  return str;
}

function getRequireDir(resourcePath) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  return path.relative(srcDir, fileDir);
}

/**
 * 压缩js
 */
function setJSMinify(content = '') {
  const ast = esprima.parseScript(content);
  estraverse.traverse(ast, {
    enter: (node) => {
      if (node.type === 'UnaryExpression' && node.operator === 'void') {
        node.type = 'CallExpression';
        node.callee = {
          type: 'Identifier',
          name: 'void',
        };
        node.arguments = [{ type: 'Literal', value: 0 }];
        node.prefix = true;
      }
    }
  });
  const transformCode = escodegen.generate(ast, {
    format: {
      ...escodegen.FORMAT_MINIFY,
      semicolons: true,
    }
  });
  return transformCode;
}

exports.default = miniJsLoader;