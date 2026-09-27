const { isHindi } = require('../utils.js');

describe('isHindi utility function', () => {
  it('should return true for words containing only Hindi characters', () => {
    expect(isHindi('नमस्ते')).toBe(true);
    expect(isHindi('हिंदी')).toBe(true);
    expect(isHindi('किताब')).toBe(true);
  });

  it('should return true for mixed strings containing Hindi characters', () => {
    expect(isHindi('Hello नमस्ते')).toBe(true);
    expect(isHindi('नमस्ते 123')).toBe(true);
    expect(isHindi('MixedहिंदीWord')).toBe(true);
  });

  it('should return false for English words', () => {
    expect(isHindi('Hello')).toBe(false);
    expect(isHindi('English')).toBe(false);
    expect(isHindi('Testing')).toBe(false);
  });

  it('should return false for numbers and special characters', () => {
    expect(isHindi('12345')).toBe(false);
    expect(isHindi('!@#$%^&*()')).toBe(false);
    expect(isHindi('123 !@#')).toBe(false);
  });

  it('should return false for empty strings', () => {
    expect(isHindi('')).toBe(false);
  });

  it('should return false for other scripts (e.g., Chinese, Arabic)', () => {
    expect(isHindi('你好')).toBe(false); // Chinese
    expect(isHindi('مرحبا')).toBe(false); // Arabic
    expect(isHindi('こんにちは')).toBe(false); // Japanese
  });
});
