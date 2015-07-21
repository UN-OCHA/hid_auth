var crypto = require('crypto');
var base64url = require('base64url');

var generate = function() {
  return randomStringAsBase64Url(32);
}

/**
 * Synchronous function to generate a random string.
 *
 * This string is base64 encoded, making it safe to be
 * directly included in URLs.
 *
 * @param  int size
 *   Number of characters to generate.
 * @return string
 */
function randomStringAsBase64Url(size) {
  return base64url(crypto.randomBytes(size));
}

exports.generate = generate;
