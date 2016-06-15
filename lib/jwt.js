/**
 * jwt
 *
 * @description :: JSON Webtoken Support
 */

var
  jwt = require('jwt-simple'),
  fs = require('fs');

// Generates a token from supplied payload
module.exports.issue = function(payload) {
  var cert = fs.readFileSync('keys/hid.rsa');
  return jwt.encode(
    payload,
    cert,
    'RS256'
  );
};

// Verifies token on a request
module.exports.verify = function(token) {
  var cert = fs.readFileSync('keys/hid.rsa.pub');
  var decoded = jwt.decode(
    token, // The token to be verified
    cert, // Same token we used to sign
    false, // No Option, for more see https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
    'RS256' //Pass errors or decoded token to callback
  );
  return decoded;
};

