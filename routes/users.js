var User = require('./../models').User;
var errors = require('./../errors');
var mail = require('./../mail');
var async = require('async');
var bcrypt = require('bcrypt');

module.exports.account = function(req, res, next) {
  req.session.returnURI = req.session.returnURI || req.query.return_uri || '';

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
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          return cb(true);
        }

        data = user;
        return cb();
      });
    },
    function (cb) {
      // Validate the submitted form values.

      // If the email address is missing, then this form isn't submitted yet.
      if (options.email == undefined) {
        return cb(true);
      }

      // Verify form user_id matches session user_id
      if (options.email !== req.session.userId) {
        message = "Invalid account settings submission. Please try again or contact an administrator.";
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
        return cb();
      }
      else if (options.email !== data.email || options.email_recovery !== data.email_recovery || (options.pass_new && String(options.pass_new).length)) {
        User.authenticate(data.email, options.pass_current, function(err, result) {
          if (result) {
            // Current password is correct. Allow save to continue.
            return cb();
          }
          else {
            // Current password is incorrect. Abort the submission.
            message = "The current password provided is incorrect. Please try again.";
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
            return cb(true);
          }
          else {
            data = item;
            message = 'Settings successfully saved.';
            if (req.session.returnURI) {
              message += ' Return to  <a href="' + req.session.returnURI + '">' + req.session.returnURI + '</a>.';
            }
            return cb();
          }
        });
      }
    }
  ],
  function (err, results) {
    if (submitted && redirect_uri && redirect_uri != undefined && String(redirect_uri).length) {
      res.redirect(redirect_uri);
    }
    else {
      if (!data.email_recovery || typeof data.email_recovery != 'String') {
        data.email_recovery = '';
      }
      if (!data.name_given || typeof data.name_given != 'String') {
        data.name_given = '';
      }
      if (!data.name_family || typeof data.name_family != 'String') {
        data.name_family = '';
      }
      res.render('account', {user: data, message: message, redirect: req.session.returnURI, client_id: '', redirect_uri: redirect_uri, csrf: req.csrfToken(), allowPasswordReset: req.session.allowPasswordReset || 0});
    }
    next();
  });
};

module.exports.showjson = function(req, res, next) {
  User.findOne({email: req.user.id}, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new errors.NotFound('showjson: User not found for ' + req.session.userId, req.session));

    // Remove sensitive fields. The delete operator did not work.
    user.hashed_password = undefined;
    user.email_recovery = undefined;
    user._id = undefined;
    user.__v = undefined;

    // Return the JSON serialized user object
    res.send(JSON.stringify(user));
    return next();
  });
};

module.exports.resetpw = function(req, res, next) {
  var email = (req.body && req.body.email) ? req.body.email : undefined,
    options = {},
    message = null,
    data;

  req.session.returnURI = req.session.returnURI || req.query.return_uri || '';

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
      var redirect_uri = req.body.redirect_uri || '',
        now = Date.now(),
        // TODO Add return_uri to this link
        reset_url = req.protocol + "://" + req.get('host') + "/resetpw/" + new Buffer(data.email + "/" + now + "/" + new Buffer(User.hashPassword(data.hashed_password + now + data.user_id)).toString('base64')).toString('base64');

      if (String(req.session.returnURI).length) {
        reset_url += '?return_uri=' + req.session.returnURI;
      }

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
          console.log(error);
          message = 'Password reset email sending failed. Please try again or contact administrators.';
          return cb(true);
        }
        else {
          console.log('Message sent: ' + info.response);
          message = 'Sending password successful! Check your email and follow the included link to reset your password.';
          return cb();
        }
      });
    }
  ],
  function (err, results) {
    res.render('index', {action: 'help', options: options, message: message, redirect: req.body.redirect || '', client_id: req.body.client_id || '', redirect_uri: req.body.redirect_uri || '', csrf: req.csrfToken()});
    next();
  });
};

module.exports.resetpwuse = function(req, res, next) {
  var encodedKey = (req.params && req.params.key) ? req.params.key : undefined;

  req.session.returnURI = req.session.returnURI || req.query.return_uri || '';

  if (encodedKey != undefined && String(encodedKey).length) {
    // decode key
    var key = new Buffer(encodedKey, 'base64').toString('ascii'),
      parts = key.split('/'),
      email = parts[0],
      timestamp = parts[1],
      hash = new Buffer(parts[2], 'base64').toString('ascii'),
      now = Date.now();

    // verify timestamp is not too old (allow up to 1 day in milliseconds)
    if (timestamp < (now - 86400000) || timestamp > now) {
      return next(new errors.BadRequest('Password reset link expired.'));
    }

    // look up user
    User.findOne({email: email}, function(err, user) {
      if (err) return next(err);
      if (!user) return next(new errors.NotFound('User not found'));

      // verify hash
      if (!bcrypt.compareSync(user.hashed_password + timestamp + user.user_id, hash)) {
        return next(new errors.BadRequest('Invalid password reset link.'));
      }

      // log operation
      console.log('valid password link for ' + email + '. initiating session');

      // activate user since the account seems to be valid
      if (!user.active) {
        User.findOne({ user_id: user.user_id }, function (err, user){
          user.active = 1;
          user.save();
        });
        // redirect the user once they have been activated
        res.redirect(req.session.returnURI);
      }

      // register session
      req.session.userId = user.email;

      // set session variable to allow password resets
      req.session.allowPasswordReset = timestamp;

      // redirect to account page to change password
      res.redirect('account');
    });
  }
};
