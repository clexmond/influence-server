class PackedData {
  /**
   * @param {Object} packedData<Array<Number>>, packedWidth<Number>, size<Number>
   * @returns {PackedData}
   * @throws {Error}
   * @constructor
   */
  constructor({ packedData, packedWidth, size } = {}) {
    if (!Number.isInteger(packedWidth) || packedWidth <= 0 || packedWidth > 32) {
      throw new Error("Invalid packedWidth");
    }

    if (Array.isArray(packedData)) {
      this.packedData = packedData;
      this.packedWidth = packedWidth;
    } 
    else if (Number.isInteger(size) && size > 0) {
      this.packedData = new Array(Math.ceil(size * packedWidth / 32)).fill(0);
      this.packedWidth = packedWidth;
    } 
    else {
      throw new Error("Provide either packedData (array) or size (number)");
    }
  }

  /**
   * Convinience method to get the packed data. *Note*: this is the raw packed data
   * @returns {Array<Number>}
  */
  toArray() {
    return this.packedData;
  }

  /**
   * Convinience method to get the packed data. *Note*: this is the raw packed data
   * @returns {Array<Number>}
  */
  valueOf() {
    return this.packedData;
  }

  /**
   * Returns the value at the given index
   * @param {Number} index
   * @returns {Number}
   */
  get(index) {
    const wordIndex = Math.floor(index * this.packedWidth / 32);
    const startBit = index * this.packedWidth % 32;

    const current = this.packedData[wordIndex];
    const availableBits = 32 - startBit;

    // case 1: our packedWidth fits in the rest of the word
    if (this.packedWidth <= availableBits) {
      const shift = availableBits - this.packedWidth;
      const mask = this.packedWidth === 32 ? 0xFFFFFFFF : (1 << this.packedWidth) - 1;
      return (current >>> shift) & mask;
    }

    // case 2: the value spans two words
    else {
      const next = this.packedData[wordIndex + 1];

      const firstPartWidth = availableBits;
      const secondPartWidth = this.packedWidth - firstPartWidth;

      // lower bits from current word
      const firstMask = (1 << firstPartWidth) - 1;
      const firstPart = current & firstMask;

      // upper bits from next word
      const secondShift = 32 - secondPartWidth;
      const secondMask = (1 << secondPartWidth) - 1;
      const secondPart = (next >>> secondShift) & secondMask;

      return (firstPart << secondPartWidth) | secondPart;
    }
  }

  /**
   * Sets the value at the given index
   * @param {Number} index
   * @param {Number} value
   */
  set(index, value) {
    const wordIndex = Math.floor(index * this.packedWidth / 32);
    const startBit = index * this.packedWidth % 32;

    const current = this.packedData[wordIndex];
    const availableBits = 32 - startBit;

    // case 1: our packedWidth fits in the rest of the word
    if (this.packedWidth <= availableBits) {
      const shift = availableBits - this.packedWidth;
      const mask = this.packedWidth === 32 ? 0xFFFFFFFF : ((1 << this.packedWidth) - 1) << shift;
      const shiftedValue = (value << shift) & mask;
      this.packedData[wordIndex] = (current & (~mask) | shiftedValue);
    }

    // case 2: the value spans two words
    else {
      const next = this.packedData[wordIndex + 1];

      const firstPartWidth = availableBits;
      const secondPartWidth = this.packedWidth - firstPartWidth;

      // lower bits into current word
      const firstMask = (1 << firstPartWidth) - 1;
      const shiftedFirstPart = (value >>> secondPartWidth) & firstMask;

      // upper bits into next word
      const secondPartShift = 32 - secondPartWidth;
      const secondMask = ((1 << secondPartWidth) - 1) << secondPartShift;
      const shiftedSecondPart = (value << secondPartShift) & secondMask;

      this.packedData[wordIndex] = (current & (~firstMask) | shiftedFirstPart);
      this.packedData[wordIndex + 1] = (next & (~secondMask) | shiftedSecondPart);
    }
  }
}

module.exports = PackedData;
