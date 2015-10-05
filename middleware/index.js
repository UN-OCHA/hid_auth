var async = require('async');
var models = require('./../models');
var log = require('../log');
var User = models.User;
var Client = models.OAuthClientsModel;
var config = require('./../config');

function requiresWebUser(req, res, next) {
  if (req.session.userId) {
    User.findOne({email: req.session.userId}, function(err, user) {
      if (err || !user) {
        log.warn({'type': 'admin:error', 'message': 'Could not load user object for user ' + req.session.userId, 'err': err, 'user': user});
        return res.status(403).send('Access Denied').end();
      }
      else if (!user.active) {
        log.warn({'type': 'admin:error', 'message': 'Currently authenticated user is inactive.', 'user': user});
        return res.status(403).send('Access Denied').end();
      }
      req.user = user;
      next();
    });
  }
  else {
    log.warn({'type': 'access:unauthorized', 'message': 'Unauthorized access attempt.'});
    return res.status(403).send('Access Denied').end();
  }
}


function requiresAdminAccess(req, res, next) {
  if (req.user && (!req.user.roles || req.user.roles.indexOf('admin') == -1)) {
    log.warn({'type': 'admin:error', 'message': 'Non-administrator attempted access to protected resources.', 'user': req.user})
    return res.status(403).send('Access Denied').end();
  }
  next();
}

function requiresWebOrApiUser(req, res, next) {
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
        log.warn({'type': 'apiKeySecret:error', 'message': 'API request submitted without client ID, access key, or data.', 'body': req.body, 'query': req.query});
        return cb(true);
      }

      // Step 1: Validate that the client app is allowed
      Client.findOne({clientId: client_id}, function (err, data) {
        if (err) {
          log.warn({'type': 'apiKeySecret:error', 'message': 'Error occurred while looking up client ' + client_id});
          return cb(err);
        }
        else if (data && data.clientSecret) {
          clientData = data;
          return cb();
        }
        else {
          // Client not found.
          log.warn({'type': 'apiKeySecret:error', 'message': 'API key validation failed. Client ' + client_id + ' not found.'});
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
        log.info({'type': 'apiKeySecret:success', 'message': 'API key/secret validated.'});
        req.client_key = client_id;
        return cb();
      }
      else {
        log.warn({'type': 'apiKeySecret:error', 'message': 'API key/secret validation failed.'});
        return cb(true);
      }
    }
  ], function (err) {
    if (err) {
      return res.status(403).send('Access Denied').end();
    }
    next();
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

module.exports.getProfilesAccessKey = function(req){
  //Get client access key
  var access_key = '';
  var SHA256 = require("crypto-js/sha256");
  var data = req;
  var valuesList = flattenValues(data, '') + config.profilesClientSecret;
  access_key = SHA256(valuesList);

  return access_key;
}


module.exports.requiresWebOrApiUser = requiresWebOrApiUser;
module.exports.requiresWebUser = requiresWebUser;
module.exports.requiresAdminAccess = requiresAdminAccess;
module.exports.requiresKeySecret = requiresKeySecret;
