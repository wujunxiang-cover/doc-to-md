import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHeading, isNumberedQuestion } from '../js/structure.mjs';

const level = (line, context) => detectHeading(line, context)?.level ?? null;

test('recognizes chapter hierarchy', () => {
  assert.equal(level('第一章 计算机网络'), 1);
  assert.equal(level('第一节 网络协议'), 2);
  assert.equal(level('一、选择题'), 1);
});

test('recognizes decimal and parenthesized heading levels', () => {
  assert.equal(level('1.1 网络协议'), 2);
  assert.equal(level('1.1.1 可靠传输机制'), 3);
  assert.equal(level('（一）基本概念'), 2);
  assert.equal(level('（1）滑动窗口'), 3);
  assert.equal(level('① 停止等待协议'), 3);
  assert.equal(level('1）传输层协议'), 2);
});

test('recognizes wrapped Unicode heading markers and protects numbered prose', () => {
  assert.equal(level('【1】 TCP可靠传输机制'), 2);
  assert.equal(level('❶ 滑动窗口'), 3);
  assert.equal(level('1. 今天完成了三个任务。'), null);
  assert.equal(level('今天完成了3个任务。'), null);
  assert.equal(level('1. 先打开设置', { nextLine: '2. 再保存修改' }), null);
  assert.equal(level('1）先打开设置', { nextLine: '2）再保存修改' }), null);
});

test('keeps question-number forms distinct from heading levels', () => {
  for (const item of ['Q1 网络协议', '题目1 网络协议', '第1题 网络协议']) {
    assert.equal(isNumberedQuestion(item), true);
    assert.equal(level(item), null);
  }
});
