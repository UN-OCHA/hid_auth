var async = require('async'),
  escapeStringRegexp = require('escape-string-regexp'),
  log = require('./../log'),
  User = require('./../models').User,
  config = require('./../config'),
  mail = require('./../mail');

exports.register = function(req, res) {
  var status = 'error',
    email,
    nameLast,
    nameFirst,
    active,
    emailFlag,
    adminName,
    adminEmail,
    inviter,
    location,
    data = {};

  var hashed_password = "";

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
      location = req.body.location;
      adminName = req.body.adminName || null;
      adminEmail = req.body.adminEmail || null;
      active = req.body.active || 0;
      emailFlag = req.body.emailFlag || false;
      inviter = req.body.inviter || null;

      // Check if email is already registered.
      User.findOne({email: new RegExp('^' + escapeStringRegexp(req.body.email) + '$', 'i')}, function (err, user) {
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
        hashed_password = user.hashed_password;
        data = {
          user_id: user.user_id,
          is_new: 1
        };
        log.info({'type': 'apiRegister:success', 'message': 'api/register Account registration success for user with email ' + email + ' by client ' + req.client_key});
        return cb();
      });

    },
    function (cb){
      //Send email for ghost accounts
      if (emailFlag == '1'){
        // Set up email content
        var subject = '';
        var now = Date.now(),
          clientId = req.body.client_id || req.client_key || '';
          reset_url = config.rootURL || (req.protocol + "://" + req.get('host'));

        // Use the resetpw endpoint so that ghost users are directed to their
        // account page to set their password, as they did not go through the
        // self-registration process.
        reset_url += "/resetpw/" + new Buffer(email + "/" + now + "/" + new Buffer(User.hashPassword(hashed_password + now + data.user_id)).toString('base64') + "/" + clientId).toString('base64');

        if (!adminName){
          subject = 'Account verify link for ' + req.app.get('title');
        }
        else{
          subject = adminName + ' has invited you to join Humanitarian ID';
        }
        var mailOptions = {
          to: email,
          subject: subject,
          nameFirst: nameFirst,
          adminName: adminName,
          reset_url: reset_url,
          location: location
        };
        if (adminEmail) {
          mailOptions.cc = !adminName ? adminEmail : adminName + '<' + adminEmail + '>';
        }
        if (inviter) {
          mailOptions.cc = mailOptions.cc + ',' + inviter.name + '<' + inviter.email + '>';
          mailOptions.adminName = inviter.name;
        }

        // Send mail
        mail.sendTemplate('register_ghost', mailOptions, function (err, info) {
          if (err) {
            message = 'Verify email sending failed. Please try again or contact administrators.';
            log.warn({'type': 'registerEmail:error', 'message': 'Registration verification email sending failed to ' + data.email + '.', 'err': err, 'info': info});
            return cb(true);
          }
          else {
            message = 'Verify email sent successful! Check your email and follow the included link to verify your account.';
            log.info({'type': 'registerEmail:success', 'message': 'Registration verification email sending successful to ' + data.email + '.', 'info': info, 'resetUrl': reset_url});
            options = {};
            return cb();
          }
        });
      }
      else{
        return cb();
      }
    },
  ], function (err) {
    res.send(JSON.stringify({status: status, data: data}));
  });
}

exports.resetpw = function(req, res) {
  var status = 'error',
    email,
    emailFlag,
    adminName,
    clientId,
    data = {};

  async.series([
    function (cb) {
      // Check inputs
      clientId = req.client_key || '';
      if (!req.body.email || !req.body.email.length) {
        log.warn({'type': 'apiResetPw:error', 'message': 'api/register method called without email address by client ' + clientId});
        return cb(true);
      }
      email = req.body.email;
      emailFlag = req.body.emailFlag || false;
      adminName = req.body.adminName || false;
      return cb();
    },
    function (cb) {
      // Use lib/passwordReset.js and pass through the email flag if given.
      require('./../lib/passwordReset').passwordReset(email, adminName, clientId, emailFlag, cb);
    },
  ], function (err, results) {
    res.send(JSON.stringify(results[1] || {'status': 'error', 'message': 'An error occurred processing the request.'}));
  });
}

exports.users = function(req, res) {
  async.series([
    function (cb) {
      User.findOne({email: new RegExp('^' + escapeStringRegexp(req.body.email) + '$', 'i')}, function(err, user) {
        if (err || !user) {
          message = "Could not load user. Please try again."
          log.warn({type: 'api:users:error', message: 'Failed to load user.', err: err});
          return cb(err);
        }
        var output = user.sanitize();
        if (!user.active) {
          // Send claim
          var now = Date.now(),
            clientId = req.body.client_id || req.client_key || '';
            reset_url = config.rootURL || (req.protocol + "://" + req.get('host'));
          reset_url += "/resetpw/" + new Buffer(user.email + "/" + now + "/" + new Buffer(User.hashPassword(user.hashed_password + now + user.user_id)).toString('base64') + "/" + clientId).toString('base64');
          output.reset_url = reset_url;
        }
        return cb(null, output);
      })
    }
  ], function (err, results) {
    res.send(results[0] || {'status': 'error', 'message': 'An error occurred processing the request.'});
  });
}
