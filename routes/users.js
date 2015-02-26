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
        log.warn({'type': 'account:error', 'message': 'User with session ID ' + req.session.userId + ' attempted to change user account with email ' + options.email + '.', 'session': req.session, 'user': user});
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
      return next(err);
    }
    if (!user) {
      return next(new errors.NotFound('showjson: User not found for ' + req.session.userId, req.session));
    }

    // Remove sensitive fields. The delete operator did not work.
    user.hashed_password = undefined;
    user.email_recovery = undefined;
    user._id = undefined;
    user.__v = undefined;

    // Return the JSON serialized user object
    res.send(JSON.stringify(user));
  });
};

module.exports.resetpw = function(req, res) {
  var email = (req.body && req.body.email) ? req.body.email : undefined,
    options = {},
    message = null,
    data;

  async.series([
    function (cb) {
      // Validate the email address
      if (email == undefined || !String(email).length) {
        message = "An email address is required to reset an account's password.";
        options.email = email;
        return cb(true);
      }
      else {
        return cb();
      }
    },
    function (cb) {
      // Ensure an account exists with the email address (as the primary or
      // recovery email address).
      User.findOne({email: email}, function(err, user) {
        if (user && user.user_id) {
          data = user;
          return cb();
        }

        User.findOne({email_recovery: email}, function(err, user) {
          if (user && user.user_id) {
            data = user;
            return cb();
          }
          else {
            message = "Could not find an account linked to the email address " + email + ".";
            return cb(true);
          }
        });
      });
    },
    function (cb) {
      // Generate password reset link and send it in an email to the requested
      // email address.
      var now = Date.now(),
        clientId = req.body.client_id || '',
        reset_url = config.rootURL || (req.protocol + "://" + req.get('host'));

      reset_url += "/resetpw/" + new Buffer(data.email + "/" + now + "/" + new Buffer(User.hashPassword(data.hashed_password + now + data.user_id)).toString('base64') + "/" + clientId).toString('base64');

      // Set up email content
      var mailText = 'A password reset link for ' + req.app.get('title') + ' was requested for the account linked to the email address ' + data.email + '. Please follow this link to regain access to your account and reset your password: ' + reset_url;
      var mailOptions = {
        from: req.app.get('title') + ' <' + req.app.get('emailFrom') + '>',
        to: email,
        subject: 'Password reset for ' + req.app.get('title'),
        text: mailText
      };
  
      // Send mail
      mail.sendMail(mailOptions, function(error, info){
        if (error) {
          message = 'Password reset email sending failed. Please try again or contact administrators.';
          log.warn({'type': 'resetPassword:error', 'message': 'Error occurred while sending password reset email for ' + req.body.email + '.', 'error': error, 'info': info});
          return cb(true);
        }
        else {
          message = 'Sending password successful! Check your email and follow the included link to reset your password.';
          log.warn({'type': 'resetPassword:success', 'message': 'Reset password email sent successfully to ' + req.body.email + '.', 'info': info, 'resetUrl': reset_url});
          return cb();
        }
      });
    }
  ],
  function (err, results) {
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

    // verify timestamp is not too old (allow up to 1 day in milliseconds)
    if (timestamp < (now - 86400000) || timestamp > now) {
      log.warn({'type': 'resetPassword:error', 'message': 'Password reset link expired.'});
      return next(new errors.BadRequest('Password reset link expired.'));
    }

    // look up user
    User.findOne({email: email}, function(err, user) {
      if (err) {
        return next(err);
      }
      if (!user) {
        log.warn({'type': 'resetPassword:error', 'message': 'Password reset link used but user could not be found.'});
        return next(new errors.NotFound('User not found'));
      }

      // verify hash
      if (!bcrypt.compareSync(user.hashed_password + timestamp + user.user_id, hash)) {
        log.warn({'type': 'resetPassword:error', 'message': 'Password reset link has invalid hash.'});
        return next(new errors.BadRequest('Invalid password reset link.'));
      }

      // log operation
      log.info({'type': 'resetPassword:success', 'message': 'Valid password link used for email ' + email + '. Initiating session.'});

      // activate user since the account seems to be valid (if inactive)
      if (!user.active) {
        user.active = 1;
        user.save();
        log.info({'type': 'resetPassword', 'message': 'Valid password link used for user who was not active. Activating user with email ' + email + '.'});
      }

      // register session
      req.session.userId = user.email;

      // if registration flow, and client ID is present, then redirect to client app
      // otherwise, redirect to account page, but add session variable to track client app
      if (isRegistration && clientId.length) {
        Client.findOne({clientId: clientId}, function(err, client) {
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

        // redirect to account page to change password
        res.redirect('/account');
      }
    });
  }
};
