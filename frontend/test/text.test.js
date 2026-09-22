import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleCase } from '../src/lib/text.js';

for (const [value, expected] of [['JOÃO ÁLVARES','João Álvares'],['ana-maria','Ana-Maria'],['  maria   silva ','  Maria   Silva '],['',''],[null,''],[undefined,'']]) {
  test(`FE-NOME: ${JSON.stringify(value)}`, () => assert.equal(titleCase(value), expected));
}
