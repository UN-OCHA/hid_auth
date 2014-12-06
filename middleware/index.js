var async = require('async');
var models = require('./../models');
var User = models.User;
var Client = models.OAuthClientsModel;

function requiresUser(req, res, next) {
  if (req.session.userId) {
    req.user = {id: req.session.userId}
    next();
  }
  else {
    res.app.oauth.authorise()(req, res, next);
  }
}

function requiresKeySecret(req, res, next) {
  var client_id,
    access_key,
    data,
    clientData;

  if (req.body.client_key) {
    client_id = req.body.client_key;
    access_key = req.body.access_key;
    data = req.body;
  }
  else if (req.query.client_key) {
    client_id = req.query.client_key;
    access_key = req.query.access_key;
    data = req.query;
  }

  async.series([
    function (cb) {
      if (!client_id || !client_id.length || !access_key || !access_key.length || !data) {
        console.log('API request submitted without client ID, access key, or data.');
        return cb(true);
      }

      // Step 1: Validate that the client app is allowed
      Client.findOne({clientId: client_id}, function (err, data) {
        if (err) {
          console.log('Error occurred while looking up client ' + client_id);
          return cb(err);
        }
        else if (data && data.clientSecret) {
          clientData = data;
          return cb();
        }
        else {
          // Client not found.
          console.log('API key validation failed. Client ' + client_id + ' not found.');
          return cb(true);
        }
      });
    },
    function (cb) {
      // Step 2: Reproduce the access key to validate the secret
      var SHA256 = require("crypto-js/sha256");

      delete data.client_key;
      delete data.access_key;

      var valuesList = flattenValues(data, '') + clientData.clientSecret;
      var re_access_key = SHA256(valuesList);

      if (access_key === re_access_key.toString()) {
        console.log('API key/secret validated.');
        req.client_key = client_id;
        return cb();
      }
      else {
        console.log('API key/secret validation failed.');
        return cb(true);
      }
    }
  ], function (err) {
    return next(err);
  });
}

function flattenValues(q, strlist) {
  var tempList = '';
  for (var key in q) {
    var type = typeof q[key];
    if (type == 'object' || type == 'array') {
      tempList += flattenValues(q[key], tempList);
    }
    else {
      tempList += q[key];
    }
  }

  return tempList;
}

function loadUser(req, res, next) {
  User.findOne({ email: req.session.userId}, function(err, user) {
    if (err) return next(err);
    res.locals.user = user;
    next();
  });
}

function isValidationError(err) {
  return err && err.name === 'ValidationError';
}

function notFoundHandler(req, res, next) {
  res.status(404);
  res.format({
    html: function() {
      res.render('404', { url: req.url });
    },
    json: function() {
      res.send({ error: 'Not Found' });
    }
  });
}

module.exports.requiresUser = requiresUser;
module.exports.requiresKeySecret = requiresKeySecret;
module.exports.loadUser = loadUser;
module.exports.isValidationError = isValidationError;
module.exports.notFoundHandler = notFoundHandler;