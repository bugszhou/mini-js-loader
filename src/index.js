'use strict';
const esprima = require('esprima'),
  estraverse = require('estraverse'),
  escodegen = require('escodegen');

Object.defineProperty(exports, "__esModule", {
  value: true
});
const path = require("path"),
  fs = require("fs"),
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

  if (typeof options.undefinedToVoid !== 'boolean') {
    options.undefinedToVoid = true;
  }

  if (typeof options.emitFile === 'undefined' || options.emitFile) {
    this.emitFile(outputPath, unicode2Char(setJSMinify(source, options.undefinedToVoid), options.isUnicode2Char));
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
  let tmpPath = resourcePath;
  if (tmpPath.includes("node_modules")) {
    tmpPath = getNodeModulesSource(resourcePath);
  }
  const fileDir = path.dirname(tmpPath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  return path.relative(srcDir, fileDir);
}

/**
 * 压缩js
 */
function setJSMinify(content = '', undefinedToVoid) {
  if (!undefinedToVoid) {
    return content;
  }
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

/**
 * unicode转中文
 */
function unicode2Char(source = "", isUnicode2Char) {
  if (isUnicode2Char === false) {
    return source;
  }
  const ast = esprima.parseScript(source);
  estraverse.traverse(ast, {
    enter: (node) => {
      if (node.type === "Literal") {
        if (node.raw && /\\[u]/gi.test(node.raw)) {
          node.raw = node.value;
        }
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

function getNodeModulesSource(resourcePath) {
  const nodeModulesPath = path.resolve(process.cwd(), "node_modules");
  const moduleRelativePath = path.relative(nodeModulesPath, resourcePath);
  const urls = moduleRelativePath.split("/");
  let jsonData = {};
  let ind = 1;
  if (fs.existsSync(path.resolve(nodeModulesPath, urls[0], "package.json"))) {
    try {
      jsonData = JSON.parse(fs.readFileSync(path.resolve(nodeModulesPath, urls[0], "package.json")).toString());
      ind = 1;
    } catch (e) {
      throw e;
    }
  } else {
    try {
      jsonData = JSON.parse(fs.readFileSync(path.resolve(nodeModulesPath, urls[0], urls[1], "package.json")).toString());
      ind = 2;
    } catch (e) {
      throw e;
    }
  }
  if (!jsonData.miniprogram && !jsonData.files) {
    return resourcePath;
  }
  let libNames = [];
  if (Array.isArray(jsonData.files)) {
    libNames = [...jsonData.files, jsonData.miniprogram || ""];
  } else {
    libNames = [jsonData.files, jsonData.miniprogram || ""];
  }

  // if (libNames.includes(urls[ind])) {
  //   return path.resolve(nodeModulesPath, urls.join("/"));
  // }
  urls.splice(ind, 1, "");
  return path.resolve(nodeModulesPath, urls.join("/"));
}

exports.default = miniJsLoader;