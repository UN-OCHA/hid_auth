var User = require('./../models').User;
var mail = require('./../mail');
var async = require('async');

module.exports.form = function(req, res, next) {
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

      // Ensure the email address isn't already registered
      User.findOne({email: options.email}, function(err, user) {
        if (err || (user && user.user_id)) {
          message = 'The email address supplied is already registered with an account. Do you need to reset your password?';
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
          return cb(true);
        }
        data = user;
        return cb();
      });
    },
    function (cb) {
      // Set up email content
      var now = Date.now(),
        reset_url = req.protocol + "://" + req.get('host') + "/resetpw/" + new Buffer(data.email + "/" + now + "/" + new Buffer(User.hashPassword(data.hashed_password + now + data.user_id)).toString('base64')).toString('base64');

      if (String(req.session.redirect).length && String(req.session.clientId).length && String(req.session.redirectUri).length) {
        reset_url += '?redirect=' + req.session.redirect + '&client_id=' + req.session.clientId + '&redirect_uri=' + req.session.redirectUri;
      }

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
          console.log(err);
          message = 'Verify email sending failed. Please try again or contact administrators.';
          return cb(true);
        }
        else {
          console.log('Message sent: ' + info.response);
          message = 'Verify email sent successful! Check your email and follow the included link to verify your account.';
          // message += "\nLINK: " + reset_url;
          options = {};
          return cb();
        }
      });
    }
  ],
  function (err, results) {
    res.render('index', {options: options, message: message, redirect: '', client_id: '', redirect_uri: '', csrf: req.csrfToken()});
    next();
  });
};
