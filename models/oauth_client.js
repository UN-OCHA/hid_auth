var mongoose = require('mongoose');
var Schema = mongoose.Schema;
//TODO Move this to a config file.
var authorizedClientIds = ['drupal-proto', 'hid-local', 'hid-dev', 'hid-stage', 'hid-prod', 'hrinfo-local', 'hrinfo-dev', 'hrinfo-dev1', 'hrinfo-stage', 'hrinfo-prod'];

var OAuthClientsSchema = new Schema({
  clientName: String,
  clientId: String,
  clientSecret: String,
  redirectUri: String
});

OAuthClientsSchema.static('getClient', function(clientId, clientSecret, callback) {
  var params = { clientId: clientId };
  if (clientSecret != null) {
    params.clientSecret = clientSecret;
  }
  OAuthClientsModel.findOne(params, callback);
});

OAuthClientsSchema.static('grantTypeAllowed', function(clientId, grantType, callback) {
  if (grantType === 'password' || grantType === 'authorization_code') {
    return callback(false, authorizedClientIds.indexOf(clientId) >= 0);
  }

  callback(false, true);
});

mongoose.model('oauth_clients', OAuthClientsSchema);
var OAuthClientsModel = mongoose.model('oauth_clients');
module.exports = OAuthClientsModel;
