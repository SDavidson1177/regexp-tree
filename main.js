/* Algorithm - Sketch */
const regexpTree = require('./src/regexp-tree');
let test_regex = regexpTree.toRegExp(/^((b\D)*ba([a-z]a)*)*$/);
let ts_1 = 'bababababababababababababababababababababa';
let ts_2 = 'bababababababababababababababababababababab';

// The first match should be quick. The second is slow due to the loop-after-loop pattern
// and the fact that the pattern does not match the provided text (exponential backtracking).
console.log('Traditional match: ', test_regex.test(ts_1));
console.log('Traditional match: ', test_regex.test(ts_2));

class SubExprSequence {
  constructor(count_min, count_max) {
    // Array of SubExpr
    this.items = [];
    this.count_min = count_min;
    this.count_max = count_max;
    this.text = '';
    this.length = 0;
  }

  /*
   * Inserts a SubExpr
   *
   * @param item: SubExpr
   */
  insert(item) {
    item.index = this.items.length;
    item.sequence = this;
    item.count_total = this.count_max;
    this.length = this.items.length + 1;
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

  /*
   * Gets match text t.
   *
   * @return string
   */
  getText(t) {
    return this.text;
  }

  // Executes the matching algorithm
  // Returns true if and only if the given text can be matched
  // by this sequence.
  runMatch() {
    let missed_matches = 0;
    let start = true;
    for (
      let i = 0;
      missed_matches < this.items.length;
      i = Math.abs((i + 1) % this.items.length)
    ) {
      missed_matches = this.items[i].runMatch(start) ? 0 : missed_matches + 1;
      start = false;
    }

    // Print resulting matches
    // for (let i = 0; i < this.items.length; i++) {
    //   console.log(this.items[i].matchpoints);
    // }

    for (let i = 0; i < this.items.length; i++) {
      for (let j = 0; j < this.items[i].matchpoints.length; j++) {
        if (this.items[i].matchpoints[j][1] == this.text.length) {
          return true;
        }
      }
    }

    return false;
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
   * @return set of int
   */
  findEarliest() {
    // Returns a set of all the indices to start at next
    const retval = new Set();

    // All the start positions so far
    const start_positions = this.matchpoints.map(item => item[0]);

    // Reached max match count
    if (this.count_total <= 0) {
      return retval;
    }

    let i = Math.abs((this.index - 1) % this.sequence.length);
    for (; i != this.index; i = Math.abs((i - 1) % this.sequence.length)) {
      // Find the earliest SubExpr that count min greater than 0
      let previous = this.sequence.get(i);

      // Can appear after this subexpression. However, may not.
      for (let j = 0; j < previous.matchpoints.length; j++) {
        if (
          this.matchpoints.length == 0 ||
          !start_positions.includes(previous.matchpoints[j][1])
        ) {
          retval.add(previous.matchpoints[j][1]); // Start at the end of the previous match
        }
      }

      // Since this subexpression must be matched at least once, we must appear after it
      if (previous.count_min > 0) {
        break;
      }
    }

    if (i == this.index) {
      // Must also add our matchpoints
      for (let j = 0; j < this.matchpoints.length; j++) {
        if (!start_positions.includes(this.matchpoints[j][1])) {
          retval.add(this.matchpoints[j][1]);
        }
      }

      if (this.matchpoints.length == 0) {
        retval.add(0);
      }
    }

    this.count_total--;
    return retval;
  }

  /*
   * Runs matches on the text starting at the last index matched, but not exceeding
   * the max match count. If start is true, start at index zero.
   *
   * @param start: bool
   */
  runMatch(start) {
    let matches_found = false;
    let start_index;

    if (start) {
      start_index = new Set();
      start_index.add(0);
    } else {
      start_index = this.findEarliest();
    }

    if (start_index.size == 0) {
      return false;
    }

    // Match as much as possible
    for (let st of start_index) {
      let temp = JSON.parse(JSON.stringify(this.matchpoints));
      let i = 0;

      for (; i < this.count_max; i++) {
        let match_string = this.sequence.getText().slice(st);
        let match_res = this.pattern.exec(match_string);

        if (match_res == null || match_res['index'] != 0) {
          // Must match from start of the string
          break;
        }

        // Remember the matches
        let match_text = match_res[0];
        this.matchpoints.push([st, st + match_text.length]);

        // Increment to the next index
        st += match_text.length;
      }

      // Make sure enough matches were found
      if (i < this.count_min) {
        this.matchpoints = JSON.parse(JSON.stringify(temp));
      } else {
        matches_found = true;
      }
    }

    // Return whether or not matches were found
    return matches_found;
  }
}

// Tests
// This will try to match ^((b\D)*ba([a-z]a)*)*$
// We do this by breaking down the expression into three parts
//
// 1. (b\D){0,infinity}
// 2. (ba){1}
// 3. ([a-z]a){0,infinity}
//
// All parts wrapped by a looping operator. We then preform the less vulnerable matching
// algorithm.
//
// This is a vulnerable expression that leads to catastrophic backtracking when
// no match is found on: bababababababababababababababababababa
// However, this algorithm detects there is no match without the
// catastrohpic backtracking.

//1. Good Match

let group = new SubExprSequence(0, 4);
group.setText('bababababababababababababababababababababa');
let exp1 = new SubExpr(/b\D/, 0, 30);
let exp2 = new SubExpr(/ba/, 1, 1);
let exp3 = new SubExpr(/[a-z]a/, 0, 30);

// add expressions to sequences
group.insert(exp1);
group.insert(exp2);
group.insert(exp3);

let final_match = group.runMatch();
console.log('Final match: ', final_match);

// 2. Vulnerable
let group2 = new SubExprSequence(0, 4);
group.setText('bababababababababababababababababababababab');
exp1 = new SubExpr(/b\D/, 0, 30);
exp2 = new SubExpr(/ba/, 1, 1);
exp3 = new SubExpr(/[a-z]a/, 0, 30);

// add expressions to sequences
group2.insert(exp1);
group2.insert(exp2);
group2.insert(exp3);

final_match = group.runMatch();
console.log('Final match: ', final_match);
