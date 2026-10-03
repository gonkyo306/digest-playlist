// iTunes画像URLの解像度差し替えのUnitテスト。

import test from 'node:test';
import assert from 'node:assert/strict';
import { largeArtworkUrl } from '../js/artwork-url.js';

test('largeArtworkUrl: 解像度指定を指定サイズに置き換える', () => {
  const url = 'https://is1-ssl.mzstatic.com/image/thumb/Music.../100x100bb.jpg';
  assert.equal(largeArtworkUrl(url, 600), 'https://is1-ssl.mzstatic.com/image/thumb/Music.../600x600bb.jpg');
});

test('largeArtworkUrl: サイズ省略時は600x600になる', () => {
  const url = '.../100x100bb.jpg';
  assert.equal(largeArtworkUrl(url), '.../600x600bb.jpg');
});

test('largeArtworkUrl: 解像度パターンが無いURLはそのまま返す', () => {
  const url = 'https://example.com/no-size-here.jpg';
  assert.equal(largeArtworkUrl(url), url);
});

test('largeArtworkUrl: 空文字・nullはそのまま返す', () => {
  assert.equal(largeArtworkUrl(''), '');
  assert.equal(largeArtworkUrl(null), null);
});
