var async = require('async'),
  escapeStringRegexp = require('escape-string-regexp'),
  User = require('../models').User,
  mail = require('../mail'),
  log = require('../log');

/**
 * passwordReset()
 *
 * Send an email to the specified address for the specific message type.
 *
 * Message type values:
 * - "reset" or null (default): Standard password reset email
 * - "claim": Account claim email for pre-registered users
 *
 */
module.exports.passwordReset = function (email, adminName, clientId, messageType, callback) {
  var message = null,
    data;

  async.series([
    function (cb) {
      // Validate the email address
      if (email == undefined || !String(email).length) {
        message = "An email address is required to reset an account's password.";
        return cb(true);
      }
      else {
        return cb();
      }
    },
    function (cb) {
      // Ensure an account exists with the email address (as the primary or
      // recovery email address).
      User.findOne({email: new RegExp('^' + escapeStringRegexp(email) + '$', 'i')}, function(err, user) {
        if (user && user.user_id) {
          data = user;
          return cb();
        }

        User.findOne({email_recovery: new RegExp('^' + escapeStringRegexp(email) + '$', 'i')}, function(err, user) {
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
        reset_url = process.env.ROOT_URL || (req.protocol + "://" + req.get('host'));

      reset_url += "/resetpw/" + new Buffer(data.email + "/" + now + "/" + new Buffer(User.hashPassword(data.hashed_password + now + data.user_id)).toString('base64') + "/" + clientId).toString('base64');

      // Set up email content
      var mailText = '',
        mailSubject = '',
        nameGiven = data.name_given || '';

      switch (messageType) {
        case 'claim':
          mailSubject = (adminName && adminName.length) ? adminName + ' has invited you to join Humanitarian ID' : 'You have been invited to join Humanitarian ID';
          break;

        case 'reset':
        default:
          mailSubject = 'Password reset for Humanitarian ID';
          break;
      }

      var mailOptions = {
        to: data.email,
        subject: mailSubject,
        nameGiven: nameGiven,
        reset_url: reset_url
      };

      // Send mail
      mail.sendTemplate(messageType, mailOptions, function(error, info) {
        if (error) {
          message = 'Password reset email sending failed. Please try again or contact administrators.';
          log.warn({'type': 'resetPassword:error', 'message': 'Error occurred while sending password reset email for ' + data.email + ' (for client ' + clientId + ').', 'error': error, 'info': info, 'mailOptions': mailOptions});
          return cb(true);
        }
        else {
          message = 'Sending password successful! Check your email and follow the included link to reset your password.';
          log.warn({'type': 'resetPassword:success', 'message': 'Reset password email sent successfully to ' + data.email + ' (for client ' + clientId + ').', 'info': info, 'mailOptions': mailOptions, 'resetUrl': reset_url});
          return cb();
        }
      });
    }
  ],
  function (err, results) {
    callback(err, {status: (!err) ? 'ok' : 'error', message: message});
  });
};
