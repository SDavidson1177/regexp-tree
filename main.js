const regexpTree = require('./src/regexp-tree');

const re = regexpTree.toRegExp('/(.)*p/i');

console.log(
  re.test('aaa'), // true
  re.test('zp') // true
);

console.log('Test');
