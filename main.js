const regexpTree = require('./src/regexp-tree');

const re = regexpTree.toRegExp('/(.)*p/i');

/*
 * This will generate the AST which can be used to examine for vulnerable patterns.
 * We should be able to scan the JSON output to quikly identify the vulnerable patterns.
 */
let g_nfa = regexpTree.parse(/^(.|[^"])*"/);
// console.log(JSON.stringify(g_nfa["body"]["expressions"]));

/*
 * Optimize a loop after loop with common match string
 */
let opt = regexpTree.optimize(/(ab*[a-z]*a)*/).toString();
// console.log(opt);

/*
 * By passing a handler to regexpTree.traverse, we can execute some code every time
 * a node is traversed. Could this be helpful?
 */

// Algorithm - Sketch
// 1.
// Ex. regex: (b\D(ba){1,3}[a-z]a)*
//     text:  babababababababa
let test_regex = regexpTree.toRegExp(/^((b\D){1,2}ba([a-z]a){2,3})*$/);
let ts_1 = 'babababababababababa';
let ts_2 = 'babababababababab';
console.log(test_regex.test(ts_1), test_regex.test(ts_2));

class SubExprSequence {
  constructor(count_min, count_max) {
    // Array of SubExpr
    this.items = [];
    this.count_min = count_min;
    this.count_max = count_max;
  }

  /*
   * Inserts a SubExpr
   *
   * @param item: SubExpr
   */
  insert(item) {
    item.index = this.items.length;
    item.sequence = this;
    this.items.push(item);
  }

  /*
   * Retreives SubExpr at index i
   *
   * @param index: int
   */
  get(index) {
    return this.items[index];
  }
}

// Structure that represents an atomic match section
/*
 * @param pattern: RegExp literal
 *        count_min: int
 *        count_max: int
 */
class SubExpr {
  constructor(pattern, count_min, count_max) {
    this.pattern = pattern;
    this.count_min = count_min;
    this.count_max = count_max;
    this.sequence = null;
    this.index = -1;
    this.earliest = 0;
  }

  /*
   * Finds where to start pattern matching in a string. Will start at the earliest match
   * that has not been checked yet for the previous sub expression in the pattern.
   *
   * @param list_of_subexpr: list of SubExpr
   *
   * @return int
   */
  findEarliest() {
    let i = (this.index - 1) % this.sequence.length;
    for (; this.sequence.length > 1 && i != this.index; i++) {
      // Find the earliest SubExpr that count min greater than 0

      if (this.sequence.get(i).count_min > 0) {
        return i;
      }
    }

    return this.index;
  }
}

// Tests

let group = new SubExprSequence(0, 10);
let exp1 = new SubExpr(/b\D/, 1, 2);
let exp2 = new SubExpr(/ba/, 1, 1);
let exp3 = new SubExpr(/[a-z]a/, 2, 3);

// add expressions to sequences
group.insert(exp1);
group.insert(exp2);
group.insert(exp3);

console.log(exp1.findEarliest());

// 2.
console.log(regexpTree.parse(test_regex));
