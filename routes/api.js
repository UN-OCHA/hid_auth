var async = require('async'),
  log = require('../log'),
  User = require('./../models').User;

exports.register = function(req, res) {
  var status = 'error',
    email,
    nameLast,
    nameFirst,
    active,
    data = {};
  async.series([
    function (cb) {
      // Check inputs
      if (!req.body.email || !req.body.email.length) {
        log.warn({'type': 'apiRegister:error', 'message': 'api/register method called without email address by client ' + req.client_key});
        return cb(true);
      }
      if (!req.body.nameLast || !req.body.nameLast.length) {
        log.warn({'type': 'apiRegister:error', 'message': 'api/register method called without last name by client ' + req.client_key});
        return cb(true);
      }
      if (!req.body.nameFirst || !req.body.nameFirst.length) {
        log.warn({'type': 'apiRegister:error', 'message': 'api/register method called without first name by client ' + req.client_key});
        return cb(true);
      }
      email = req.body.email;
      nameLast = req.body.nameLast;
      nameFirst = req.body.nameFirst;
      active = req.body.active || 0;

      // Check if email is already registered.
      User.findOne({email: req.body.email}, function (err, user) {
        if (err) {
          log.warn({'type': 'apiRegister:error', 'message': 'api/register encountered error on User.findOne for email ' + req.body.email + ' by client ' + req.client_key});
          return cb(true);
        }

        if (user && user.user_id) {
          status = 'ok';
          data = {
            user_id: user.user_id,
            is_new: 0
          };
          log.info({'type': 'apiRegister', 'message': 'api/register called for registered user with email ' + req.body.email + ' by client ' + req.client_key});
          return cb(true);
        }
        else {
          return cb();
        }
      });
    },
    function (cb) {
      // If no user exists, register the user.
      var options = {
        email: email,
        name_given: nameFirst,
        name_family: nameLast,
        active: active
      },
      password = User.hashPassword(email + Date.now() + nameLast + nameFirst),
      pos = Math.floor(Math.random() * (password.length - 12));
      password = password.substr(pos, 12);
      options.password = password;

      // Register the account
      User.register(options, function (err, user) {
        if (err || !user) {
          message = 'api/register Account registration failed. Please try again or contact administrators.';
          log.warn({'type': 'apiRegister:error', 'message': 'api/register Account registration failed on User.register for email ' + email + ' by client ' + req.client_key});
          return cb(true);
        }
        status = 'ok';
        data = {
          user_id: user.user_id,
          is_new: 1
        };
        log.info({'type': 'apiRegister:success', 'message': 'api/register Account registration success for user with email ' + email + ' by client ' + req.client_key});
        return cb();
      });
      
    },
  ], function (err) {
    res.send(JSON.stringify({status: status, data: data}));
  });
}
