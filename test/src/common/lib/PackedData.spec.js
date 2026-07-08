/* eslint-disable no-bitwise */

const { expect } = require('chai');
const PackedData = require('@common/lib/PackedData');

describe('PackedData', function () {
  describe('constructor', function () {
    it('should return an instance of PackedData', function () {
      const packedData = new PackedData({ packedData: [1, 2, 3], packedWidth: 3 });
      expect(packedData).to.be.an.instanceof(PackedData);
      expect(packedData.packedData).to.deep.equal([1, 2, 3]);
      expect(packedData.packedWidth).to.equal(3);
    });
  });

  describe('toArray and valueOf', function () {
    it('should return the packedData', function () {
      const packedData = new PackedData({ packedData: [1811939328], packedWidth: 2 });
      expect(packedData.toArray()).to.deep.equal([1811939328]);
      expect(packedData.valueOf()).to.deep.equal([1811939328]);
    });
  });

  describe('get', function () {
    it('should return the value at the given index', function () {
      let packedData = new PackedData({
        packedData: [0b01_10_11_00_01_11_11_11_00_00_00_00_00_00_00_00],
        packedWidth: 2
      });
      expect(packedData.get(0)).to.equal(0b01);
      expect(packedData.get(1)).to.equal(0b10);
      expect(packedData.get(2)).to.equal(0b11);

      packedData = new PackedData({
        packedData: [0b011_011_000_111_111_100_000_000_000_000_00],
        packedWidth: 3
      });
      expect(packedData.get(0)).to.equal(0b011);
      expect(packedData.get(1)).to.equal(0b011);
      expect(packedData.get(2)).to.equal(0b000);
    });
  });

  describe('set', function () {
    it('should replace the value at the given index with the specified value (width 2)', function () {
      const packedData = new PackedData({
        packedData: [0b01_10_11_00_01_11_11_11_00_00_00_00_00_00_00_00],
        packedWidth: 2
      });
      packedData.set(3, 0b01);
      expect(packedData.valueOf()).to.deep.equal([0b01_10_11_01_01_11_11_11_00_00_00_00_00_00_00_00]);
      expect(packedData.get(3)).to.equal(0b01);
    });

    it('should replace the value at the given index with the specified value (width 8)', function () {
      let packedData;
      packedData = new PackedData({
        packedData: [
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000
        ],
        packedWidth: 8
      });

      packedData.set(0, 0b00010000);
      expect(packedData.valueOf()).to.deep.equal([
        0b00010000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000
      ]);

      packedData = new PackedData({
        packedData: [
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000
        ],
        packedWidth: 8
      });

      packedData.set(1, 0b00010000);
      expect(packedData.valueOf()).to.deep.equal([
        0b00100000_00010000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000
      ]);

      packedData = new PackedData({
        packedData: [
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000
        ],
        packedWidth: 8
      });

      packedData.set(2, 0b00010000);
      expect(packedData.valueOf()).to.deep.equal([
        0b00100000_00100000_00010000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000
      ]);

      packedData = new PackedData({
        packedData: [
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000
        ],
        packedWidth: 8
      });
      packedData.set(4, 0b10000000);
      expect(packedData.valueOf()).to.deep.equal([
        0b00100000_00100000_00100000_00100000,
        0b10000000_00100000_00100000_00100000 | 0, // force signed interpretation
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000
      ]);

      packedData = new PackedData({
        packedData: [
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000,
          0b00100000_00100000_00100000_00100000
        ],
        packedWidth: 8
      });
      packedData.set(7, 0b10000000);
      expect(packedData.valueOf()).to.deep.equal([
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_10000000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000,
        0b00100000_00100000_00100000_00100000
      ]);
    });

    it('should replace the value at the given index with the specified value (width 10)', function () {
      let packedData = new PackedData({ packedData: [
        0b1000000001_1000000001_1000000001_10 | 0, // force signed interpretation
        0b00000001_0000000000_0000000000_0000
      ],
      packedWidth: 10 });
      packedData.set(3, 0b1000000010);
      expect(packedData.valueOf()).to.deep.equal([
        0b1000000001_1000000001_1000000001_10 | 0, // force signed interpretation
        0b00000010_0000000000_0000000000_0000
      ]);

      packedData = new PackedData({ packedData: [
        0b1000000001_1000000001_1000000001_10 | 0, // force signed interpretation
        0b00000001_0000000000_0000000000_0000
      ],
      packedWidth: 10 });
      packedData.set(0, 0b1000000010);
      expect(packedData.valueOf()).to.deep.equal([
        0b1000000010_1000000001_1000000001_10 | 0, // force signed interpretation
        0b00000001_0000000000_0000000000_0000
      ]);
    });
  });
});
