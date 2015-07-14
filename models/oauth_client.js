var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var OAuthClientsSchema = new Schema({
  clientName: String,
  clientId: String,
  clientSecret: String,
  redirectUri: String,
  loginUri: String,
  description: String
});

OAuthClientsSchema.static('getClient', function(clientId, clientSecret, callback) {
  var params = { clientId: clientId };
  if (clientSecret != null) {
    params.clientSecret = clientSecret;
  }
  OAuthClientsModel.findOne(params, callback);
});

OAuthClientsSchema.static('grantTypeAllowed', function(clientId, grantType, callback) {
  var params = {
    clientId: clientId
    //TODO: add query parameters for allowed grant type
  };
  OAuthClientsModel.findOne(params, function (err, client) {
    if (!err && client && client.clientId === clientId) {
      return callback(false, true);
    }
    return callback(err, false);
  });
});

mongoose.model('oauth_clients', OAuthClientsSchema);
var OAuthClientsModel = mongoose.model('oauth_clients');
module.exports = OAuthClientsModel;
