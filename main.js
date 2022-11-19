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
    this.text = '';
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

  /*
   * Sets match text to t.
   *
   * @param t: string
   */
  setText(t) {
    this.text = t;
  }

  getText(t) {
    return this.text;
  }

  runMatch() {
    let missed_matches = 0;
    let start = true;
    for (
      let i = 0;
      missed_matches < this.items.length;
      i = (i + 1) % this.items.length
    ) {
      missed_matches = this.items[i].runMatch(start) ? 0 : missed_matches + 1;
      start = false;
    }

    // Print resulting matches
    for (let i = 0; i < this.items.length; i++) {
      console.log(this.items[i].matchpoints);
    }
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
    this.count_total = 0; // allowable amount of outer loops
    this.sequence = null;
    this.index = -1;
    this.earliest = 0;
    this.matchpoints = []; // array of lenth 2 arrays consisting of start and end index matches
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
    // Reached max match count
    if (this.count_total <= 0) {
      return -1;
    }

    let i = (this.index - 1) % this.sequence.length;
    for (
      ;
      this.sequence.length > 1 && i != this.index;
      i = (i - 1) % this.sequence.length
    ) {
      // Find the earliest SubExpr that count min greater than 0

      if (this.sequence.get(i).count_min > 0) {
        previous = this.sequence.get(i);

        // Find the next place to start matching
        for (let j = 0; j < previous.matchpoints.length; j++) {
          if (
            previous.matchpoints[j][0] >
            this.matchpoints[this.matchpoints.length - 1][1]
          ) {
            this.count_total--;
            return previous.matchpoints[j][1]; // Start at the end of the previous match
          }
        }

        return -1; // no valid location
      }
    }

    this.count_total--;
    return this.matchpoints[this.matchpoints.length - 1][1];
  }

  /*
   * Runs matches on the text starting at the last index matched, but not exceeding
   * the max match count. If start is true, start at index zero.
   *
   * @param start: bool
   */
  runMatch(start) {
    let matches_found = false;
    let start_index = start ? 0 : this.findEarliest();
    let temp = JSON.parse(JSON.stringify(this.matchpoints));
    let i = 0;

    // Match as much as possible
    for (; i < this.count_max; i++) {
      let match_string = this.sequence.getText().slice(start_index);
      let match_res = this.pattern.exec(match_string);

      if (match_res == null || match_res['index'] != 0) {
        // Must match from start of the string
        break;
      }

      matches_found = true;

      // Remember the matches
      let match_text = match_res[0];
      this.matchpoints.push([start_index, start_index + match_text.length]);

      // Increment to the next index
      start_index += match_text.length;
    }

    // Make sure enough matches were found
    if (i < this.count_min) {
      this.matchpoints = JSON.parse(JSON.stringify(temp));
      return false;
    }

    // Return whether or not matches were found
    return matches_found;
  }
}

// Tests

let group = new SubExprSequence(0, 10);
group.setText('bababa');
let exp1 = new SubExpr(/b\D/, 1, 2);
let exp2 = new SubExpr(/ba/, 1, 1);
let exp3 = new SubExpr(/[a-z]a/, 2, 3);

// add expressions to sequences
group.insert(exp1);
// group.insert(exp2);
// group.insert(exp3);

console.log(exp1.runMatch(true));
console.log(exp1.matchpoints);

const reg = /b\D/;
let match_res = reg.exec('baba');
let match_text = match_res[0];
let match_index = match_res['index'];
console.log(match_index + match_text.length);

// 2.
console.log(regexpTree.parse(test_regex));
