var mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE, {});

mongoose.connection.on('error', function(err) {
  console.error('MongoDB error: %s', err);
});

exports.oauth = require('./oauth');
exports.User = require('./user');
exports.OAuthClientsModel = require('./oauth_client');
exports.FloodEntry = require('./flood');
exports.mongoose = mongoose;
