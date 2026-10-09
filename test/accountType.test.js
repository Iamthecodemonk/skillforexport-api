import test from 'node:test';
import assert from 'node:assert/strict';
import { accountTypeFromSettings } from '../src/application/accountType.js';

test('uses the saved onboarding account type', () => {
  assert.equal(accountTypeFromSettings({ settings: { onboarding: { accountType: 'Student' } } }), 'student');
  assert.equal(accountTypeFromSettings({ settings: { onboarding: { accountType: 'professional' } } }), 'professional');
});

test('older accounts without onboarding have a stable default', () => {
  assert.equal(accountTypeFromSettings(null), 'default');
  assert.equal(accountTypeFromSettings({ settings: {} }), 'default');
});
