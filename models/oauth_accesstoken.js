var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var OAuthAccessTokensSchema = new Schema({
  accessToken: { type: String, required: true, unique: true },
  clientId: String,
  userId: { type: String, required: true },
  expires: Date
});

mongoose.model('oauth_accesstokens', OAuthAccessTokensSchema);

var OAuthAccessTokensModel = mongoose.model('oauth_accesstokens');

module.exports.getAccessToken = function(bearerToken, callback) {
  OAuthAccessTokensModel.findOne({ accessToken: bearerToken }, callback);
};

module.exports.saveAccessToken = function(token, clientId, expires, userId, callback) {
  var fields = {
    clientId: clientId,
    // This is required due to an inconsistency in the arguments passed to
    // saveAccessToken in oauth-server/lib/grant.js and
    // oauth-server/lib/authCodeGrant.js
    userId: userId.hasOwnProperty('id') ? userId.id : userId,
    expires: expires
  };

  OAuthAccessTokensModel.update({ accessToken: token }, fields, { upsert: true }, function(err) {
    if (err) {
      console.error(err);
    }

    callback(err);
  });
};
