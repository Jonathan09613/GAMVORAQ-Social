import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryApproved } from '../src/world-logic.js';

test('un recuerdo del squad no se publica hasta que todas las personas mencionadas aceptan', () => {
  assert.equal(memoryApproved([]), false);
  assert.equal(memoryApproved([{ status: 'approved' }, { status: 'pending' }]), false);
  assert.equal(memoryApproved([{ status: 'approved' }, { status: 'declined' }]), false);
  assert.equal(memoryApproved([{ status: 'approved' }, { status: 'approved' }]), true);
});
