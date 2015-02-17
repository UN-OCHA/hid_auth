var User = require('./../models').User;
var log = require('./../log');
var mail = require('./../mail');
var async = require('async');

module.exports.form = function(req, res) {
  var options = req.body || {},
    message = null,
    data;

  async.series([
    function (cb) {
      // Validate the email address
      if (options.email == undefined || String(options.email).length < 1) {
        message = 'An email address is required to register a new account.';
        return cb(true);
      }

      // Validate the given name
      if (options.name_given == undefined || String(options.name_given).length < 1) {
        message = 'A given name is required to register a new account.';
        return cb(true);
      }

      // Validate the family name
      if (options.name_family == undefined || String(options.name_family).length < 1) {
        message = 'A family name is required to register a new account.';
        return cb(true);
      }

      // Ensure the email address isn't already registered
      User.findOne({email: options.email}, function(err, user) {
        if (err || (user && user.user_id)) {
          message = 'The email address supplied is already registered with an account. Do you need to reset your password?';
          log.warn({'type': 'register:error', 'message': 'User registration attempted with email address ' + options.email + ' which is already in use by user ' + user.user_id + '.', 'fields': options});
          return cb(true);
        }
        else {
          return cb();
        }
      });
    },
    function (cb) {
      // Ensure the password fields match
      if (options.pass_new == undefined || options.pass_confirm == undefined || options.pass_new !== options.pass_confirm) {
        message = 'The password and password (confirm) fields must match.';
        return cb(true);
      }
      options.password = options.pass_new;
      options.active = 0;

      // Register the account
      User.register(options, function (err, user) {
        if (err) {
          message = 'Account registration failed. Please try again or contact administrators.';
          log.warn({'type': 'register:error', 'message': 'Error occurred while trying to register user with email address ' + options.email + '.', 'fields': options});
          return cb(true);
        }
        data = user;
        log.info({'type': 'register:success', 'message': 'User registered with email address ' + options.email + ' and generated user ID ' + user.user_id, 'fields': options});
        return cb();
      });
    },
    function (cb) {
      // Set up email content
      var now = Date.now(),
        clientId = req.body.client_id || '';
        reset_url = req.protocol + "://" + req.get('host') + "/register/" + new Buffer(data.email + "/" + now + "/" + new Buffer(User.hashPassword(data.hashed_password + now + data.user_id)).toString('base64') + "/" + clientId).toString('base64');

      var mailText = 'Thanks for registering for a ' + req.app.get('title') + ' account! Please follow this link to verify your account: ' + reset_url;
      var mailOptions = {
        from: req.app.get('title') + ' <' + req.app.get('emailFrom') + '>',
        to: data.email,
        subject: 'Account verify link for ' + req.app.get('title'),
        text: mailText
      };

      // Send mail
      mail.sendMail(mailOptions, function (err, info) {
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
  ],
  function (err, results) {
    res.render('index', {
      options: options,
      message: message,
      redirect: options.redirect || '',
      client_id: options.client_id || '',
      redirect_uri: options.redirect_uri || '',
      response_type: options.response_type || '',
      state: options.state || '',
      scope: options.scope || '',
      csrf: req.csrfToken()
    });
  });
};
