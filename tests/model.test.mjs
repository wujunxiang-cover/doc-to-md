import test from 'node:test';
import assert from 'node:assert/strict';
import {formatListNumber} from '../js/model.js';

test('keeps source numbering unless a document style overrides it',()=>{
  assert.equal(formatListNumber(2,'source','（三）'),'（三）');
  assert.equal(formatListNumber(2,'decimal','（三）'),'3.');
});

test('formats common list numbering styles',()=>{
  assert.equal(formatListNumber(1,'decimal-paren'),'(2)');
  assert.equal(formatListNumber(26,'lower-alpha'),'aa.');
  assert.equal(formatListNumber(3,'upper-roman'),'IV.');
});
