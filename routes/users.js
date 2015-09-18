var User = require('./../models').User;
var errors = require('./../errors');
var mail = require('./../mail');
var log = require('./../log');
var config = require('./../config');
var async = require('async');
var bcrypt = require('bcrypt');
var Client = require('./../models').OAuthClientsModel;

module.exports.account = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    submitted = false,
    message = null,
    data = {};

  async.series([
    function (cb) {
      // Load user based on user_id
      User.findOne({email: req.session.userId}, function(err, user) {
        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        data = user;
        return cb();
      });
    },
    function (cb) {
      // If the email address is missing, then this form isn't submitted yet.
      if (options.email == undefined) {
        return cb(true);
      }

      // Validate the submitted form values.
      if (options.name_given == undefined || options.name_given.length < 1) {
        message = "Given name is required.";
        return cb(true);
      }
      if (options.name_family == undefined || options.name_family.length < 1) {
        message = "Family name is required.";
        return cb(true);
      }

      // Verify form user_id matches session user_id
      if (options.email !== req.session.userId) {
        message = "Invalid account settings submission. Please try again or contact an administrator.";
        log.warn({'type': 'account:error', 'message': 'User with session ID ' + req.session.userId + ' attempted to change user account with email ' + options.email + '.', 'session': req.session});
        return cb(true);
      }

      // If a new password is supplied, ensure that it matches the new password
      // confirm field.
      if (options.pass_new != undefined && String(options.pass_new).length && options.pass_new !== options.pass_confirm) {
        message = "The values supplied for the New Password and New Password (confirm) fields do not match. Please check these fields and try again.";
        return cb(true);
      }

      // If the primary or recovery email addresses are changed, or if a new
      // password is supplied, then verify that the current password is correct.
      // Make an exception if the user is following a password reset link.
      if (req.session.allowPasswordReset && Date.now() < (req.session.allowPasswordReset + 5184000)) {
        req.session.allowPasswordReset = 0;
        log.info({'type': 'account', 'message': 'Session token for allowing password reset used by user ' + req.session.userId + '.'});
        return cb();
      }
      else if (options.email !== data.email || options.email_recovery !== data.email_recovery || (options.pass_new && String(options.pass_new).length)) {
        User.authenticate(data.email, options.pass_current, function(err, result) {
          if (result) {
            // Current password is correct. Allow save to continue.
            log.info({'type': 'account', 'message': 'Email address or password change requested for user ' + req.session.userId + ' and correct current password supplied.', 'currentUser': data, 'newFields': options});
            return cb();
          }
          else {
            // Current password is incorrect. Abort the submission.
            message = "The current password provided is incorrect. Please try again.";
            log.warn({'type': 'account', 'message': 'Email address or password change requested for user ' + req.session.userId + ' but password verification failed.', 'currentUser': data, 'newFields': options});
            return cb(true);
          }
        });
      }
      else {
        // Remove fields that should not be changed without a valid password.
        delete options.email;
        delete options.email_recovery;
        delete options.pass_new;
        delete options.pass_confirm;
        return cb();
      }
    },
    function (cb) {
      // Process/save the submitted form values.
      submitted = true;

      // Update any fields
      var changed = false;
      for (var key in options) {
        if (options.hasOwnProperty(key)) {
          if (key == "pass_new") {
            data.hashed_password = User.hashPassword(options.pass_new);
          }
          else {
            data[key] = options[key];
          }
          changed = true;
        }
      }
      if (changed) {
        return data.save(function (err, item) {
          if (err || !item) {
            message = "Error updating the user account.";
            log.warn({'type': 'account:error', 'message': 'Error occurred trying to update user account for email address ' + req.session.userId + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data = item;
            message = "Settings successfully saved.";
            log.info({'type': 'account:success', 'message': 'User account updated for email address ' + req.session.userId + '.', 'data': data});
            if (req.session.returnClientId) {
              Client.findOne({"clientId": req.session.returnClientId}, function (err, doc) {
                if (!err && doc.clientName && doc.loginUri) {
                  message += ' Continue to <a href="' + doc.loginUri + '">sign in to ' + doc.clientName + '</a>.';
                }
                return cb();
              });
            }
            else {
              return cb();
            }
          }
        });
      }
    }
  ],
  function (err, results) {
    if (submitted && redirect_uri && redirect_uri != undefined && String(redirect_uri).length) {
      return res.redirect(redirect_uri);
    }

    if (!data.email_recovery || typeof data.email_recovery !== 'string') {
      data.email_recovery = '';
    }
    if (!data.name_given || typeof data.name_given !== 'string') {
      data.name_given = '';
    }
    if (!data.name_family || typeof data.name_family !== 'string') {
      data.name_family = '';
    }
    res.render('account', {user: data, message: message, redirect_uri: redirect_uri, csrf: req.csrfToken(), allowPasswordReset: req.session.allowPasswordReset || 0});
  });
};

module.exports.showjson = function(req, res, next) {
  User.findOne({email: req.user.id}, function(err, user) {
    if (err) {
      log.warn({'type': 'accountJson:error', 'message': 'Error occurred trying to look up user account for email address ' + req.user.id + ': ' + err.message, 'req': req, 'err': err})
      return next(new errors.BadRequest('An error occurred. Please <a href="/#login">Sign In</a> to continue.'));
    }
    if (!user) {
      log.warn({'type': 'accountJson:error', 'message': 'Could not find user with email address ' + req.user.id, 'req': req})
      return next(new errors.BadRequest('An error occurred. Please <a href="/#login">Sign In</a> to continue.'));
    }

    // Return the JSON serialized user object
    res.send(JSON.stringify(user.sanitize()));
  });
};

module.exports.resetpw = function(req, res) {
  var email = (req.body && req.body.email) ? req.body.email : undefined,
    clientId = req.body.client_id || '',
    options = {},
    data;

  async.series([
    function (cb) {
      // Validate the email address
      if (email == undefined || !String(email).length) {
        options.email = email;
        return cb(true, {message: "An email address is required to reset an account's password."});
      }
      else {
        // Use lib/passwordReset.js and specify the "reset" version of the email.
        return require('../lib/passwordReset.js').passwordReset(email, null, clientId, 'reset', cb);
      }
    },
  ],
  function (err, results) {
    var message = (results[0] && results[0].message) ? results[0].message : undefined;
    res.render('index', {action: 'help', options: options, message: message, redirect: req.body.redirect || '', client_id: req.body.client_id || '', redirect_uri: req.body.redirect_uri || '', csrf: req.csrfToken()});
  });
};

module.exports.resetpwuse = function(req, res, next) {
  var encodedKey = (req.params && req.params.key) ? req.params.key : undefined,
    isRegistration = (req.url.match(/^\/register/) !== null) ? true : false;

  if (encodedKey != undefined && String(encodedKey).length) {
    // decode key
    var key = new Buffer(encodedKey, 'base64').toString('ascii'),
      parts = key.split('/'),
      email = parts[0],
      timestamp = parts[1],
      hash = new Buffer(parts[2], 'base64').toString('ascii'),
      clientId = parts[3] || '',
      now = Date.now();

    // verify timestamp is not too old (allow up to 7 days in milliseconds)
    if (timestamp < (now - 7 * 86400000) || timestamp > now) {
      log.warn({'type': 'resetPassword:error', 'message': 'Password reset link expired.', 'req': req});
      return next(new errors.BadRequest('This verification link is expired. Please <a href="/#forgotPass">Reset Your Password</a> to continue.'));
    }

    // look up user
    User.findOne({email: email}, function(err, user) {
      if (err) {
        log.warn({'type': 'resetPassword:error', 'message': 'An error occurred trying to find the user by email ' + email + ': ' + err.message, 'req': req, 'err': err});
        return next(new errors.BadRequest('An error occurred processing the verification link. Please <a href="/#forgotPass">Reset Your Password</a> to continue.'));
      }
      if (!user) {
        log.warn({'type': 'resetPassword:error', 'message': 'Password reset link used but user could not be found with email ' + email, 'req': req});
        return next(new errors.BadRequest('An error occurred handling the verification link. Please <a href="/#forgotPass">Reset Your Password</a> to continue.'));
      }

      // verify hash
      if (!bcrypt.compareSync(user.hashed_password + timestamp + user.user_id, hash)) {
        log.warn({'type': 'resetPassword:error', 'message': 'Password reset link has invalid hash.', 'req': req});
        return next(new errors.BadRequest('This verification link has already been used or is invalid. Please <a href="/#forgotPass">Reset Your Password</a> to continue.'));
      }

      // log operation
      log.info({'type': 'resetPassword:success', 'message': 'Valid password link used for email ' + email + '. Initiating session.', 'req': req});

      // activate user since the account seems to be valid (if inactive)
      if (!user.active) {
        user.active = 1;
        user.save();
        log.info({'type': 'resetPassword', 'message': 'Valid password link used for user who was not active. Activating user with email ' + email + '.', 'req': req});
      }

      // register session
      req.session.userId = user.email;

      // if registration flow, and client ID is present, then redirect to client app
      // otherwise, redirect to account page, but add session variable to track client app
      if (isRegistration && clientId.length) {
        Client.findOne({clientId: clientId}, function(err, client) {
          var mailOptions = {
            to: user.email,
            subject: 'Humanitarian ID account created. Create your profile and check-in',
            first_name: user.name_given
          };

          // Send mail
          mail.sendTemplate('post_registration_client', mailOptions, function (err, info) {
            if (err) {
              message = 'Post registration email sending failed. Please try again or contact administrators.';
              log.warn({'type': 'postRegistrationEmail:error', 'message': 'Post registration verification email sending failed to ' + user.email + '.', 'err': err, 'info': info});
              return next(new errors.BadRequest('Error sending post-registration email.'));
            }
            else {
              message = 'Post registration email sent successful! Check your email and follow the included link to verify your account.';
              log.info({'type': 'postRegistrationEmail:success', 'message': 'Post registration verification email sending successful to ' + user.email + '.', 'info': info});
              options = {};
              return next();
            }
          });

          if (client && client.loginUri && client.loginUri.length) {
            return res.redirect(client.loginUri);
          }
          else if (client && client.redirectUri && client.redirectUri.length) {
            return res.redirect(client.redirectUri);
          }
          else {
            // set session variable to allow password resets
            req.session.allowPasswordReset = timestamp;

            // redirect to account page to change password
            res.redirect('/account');
          }
        });
      }
      else {
        // set session variable to allow password resets
        req.session.allowPasswordReset = timestamp;

        // set session variable to allow link to originating client app
        req.session.returnClientId = clientId.length ? clientId : null;

        if (isRegistration) {
          var mailOptions = {
            to: user.email,
            subject: 'Humanitarian ID account created. Create your profile and check-in',
            first_name: user.name_given
          };

          // Send mail
          mail.sendTemplate('post_registration_hid', mailOptions, function (err, info) {
            if (err) {
              message = 'Post registration email sending failed. Please try again or contact administrators.';
              log.warn({'type': 'postRegistrationEmail:error', 'message': 'Post registration verification email sending failed to ' + user.email + '.', 'err': err, 'info': info});
              return next(new errors.BadRequest('Error sending post-registration email.'));
            }
            else {
              message = 'Post registration email sent successful! Check your email and follow the included link to verify your account.';
              log.info({'type': 'postRegistrationEmail:success', 'message': 'Post registration verification email sending successful to ' + user.email + '.', 'info': info});
              options = {};
              return next();
            }
          });
        }

        // redirect to account page to change password
        res.redirect('/account');
      }
    });
  }
};
