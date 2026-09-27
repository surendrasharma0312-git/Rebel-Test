function isHindi(str) {
  return /[\u0900-\u097F]/.test(str);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isHindi };
}
