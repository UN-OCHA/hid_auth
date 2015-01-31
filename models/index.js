var config = require('./../config');
var mongoose = require('mongoose');

mongoose.connect(config.db, {});

mongoose.connection.on('error', function(err) {
  console.error('MongoDB error: %s', err);
});

exports.oauth = require('./oauth');
exports.User = require('./user');
exports.OAuthClientsModel = require('./oauth_client');
exports.mongoose = mongoose;
