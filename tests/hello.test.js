import { describe, it, expect } from 'vitest';
import { hello } from '../src/hello.js';

describe('hello()', () => {
  it('greets by default', () => {
    expect(hello()).toBe('Hello, World!');
  });

  it('greets a given name', () => {
    expect(hello('Jena')).toBe('Hello, Jena!');
  });
});
