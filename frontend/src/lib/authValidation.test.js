import { describe, expect, it } from 'vitest';

import {
  scorePassword,
  validateDob,
  validateEmail,
  validateFields,
  validatePassword,
  validatePassword2,
  STEP_FIELDS,
} from './authValidation';

const TODAY = new Date(2026, 7, 28); // 28 Aug 2026

describe('validateDob', () => {
  it('wants a date, in the past, within a lifetime', () => {
    expect(validateDob('')).toBe('required');
    expect(validateDob('2026-08-28', TODAY)).toBe('dobFuture');
    expect(validateDob('2027-01-01', TODAY)).toBe('dobFuture');
    expect(validateDob('2026-08-27', TODAY)).toBeNull();
    expect(validateDob('2012-05-01', TODAY)).toBeNull();
    expect(validateDob('1890-05-01', TODAY)).toBe('dobInvalid');
    expect(validateDob('not-a-date', TODAY)).toBe('dobInvalid');
  });
});

describe('validateEmail', () => {
  it('accepts an address and rejects the shapes children type', () => {
    expect(validateEmail('aziz@school.uz')).toBeNull();
    expect(validateEmail('  aziz@school.uz ')).toBeNull();
    expect(validateEmail('')).toBe('required');
    expect(validateEmail('aziz')).toBe('invalidEmail');
    expect(validateEmail('aziz@school')).toBe('invalidEmail');
    expect(validateEmail('aziz @school.uz')).toBe('invalidEmail');
  });
});

describe('validatePassword', () => {
  it('mirrors the two Django validators worth catching early', () => {
    expect(validatePassword('')).toBe('required');
    expect(validatePassword('short1')).toBe('tooShort');
    expect(validatePassword('12345678')).toBe('allDigits');
    expect(validatePassword('passw0rd')).toBeNull();
  });

  it('wants the repeat to match', () => {
    expect(validatePassword2('', 'x')).toBe('required');
    expect(validatePassword2('abc', 'abd')).toBe('passwordsDoNotMatch');
    expect(validatePassword2('abcdefgh', 'abcdefgh')).toBeNull();
  });
});

describe('validateFields', () => {
  it('reports only the fields asked about', () => {
    const form = { first_name: '', last_name: 'Karimov', date_of_birth: '2012-05-01', email: '', password: '', password2: '' };
    expect(validateFields(STEP_FIELDS[1], form)).toEqual({ first_name: 'required' });
    expect(validateFields(STEP_FIELDS[2], form)).toEqual({ email: 'required', password: 'required', password2: 'required' });
  });
});

describe('scorePassword', () => {
  it('grows with length and mix, and digits alone stay weak', () => {
    expect(scorePassword('')).toBe(0);
    expect(scorePassword('abc')).toBe(1);
    expect(scorePassword('password')).toBe(1);
    expect(scorePassword('1234567890123456')).toBe(1);
    expect(scorePassword('passw0rd')).toBe(2);
    expect(scorePassword('Passw0rd!x')).toBe(3);
    expect(scorePassword('longerpassw0rd')).toBe(3);
    expect(scorePassword('Str0ngPassw0rd!x')).toBe(4);
  });
});
