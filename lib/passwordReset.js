var async = require('async'),
  escapeStringRegexp = require('escape-string-regexp'),
  User = require('../models').User,
  mail = require('../mail'),
  log = require('../log'),
  config = require('../config');

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
      User.findOne({email: new RegExp(escapeStringRegexp(email), 'i')}, function(err, user) {
        if (user && user.user_id) {
          data = user;
          return cb();
        }

        User.findOne({email_recovery: new RegExp(escapeStringRegexp(email), 'i')}, function(err, user) {
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
        reset_url = config.rootURL || (req.protocol + "://" + req.get('host'));

      reset_url += "/resetpw/" + new Buffer(data.email + "/" + now + "/" + new Buffer(User.hashPassword(data.hashed_password + now + data.user_id)).toString('base64') + "/" + clientId).toString('base64');

      // Set up email content
      var mailText = '',
        mailSubject = '',
        nameGiven = data.name_given || '';

      switch (messageType) {
        case 'claim':
          mailSubject = (adminName && adminName.length) ? adminName + ' has invited you to join Humanitarian ID' : 'You have been invited to join Humanitarian ID';

          mailText = 'Dear ' + nameGiven + ',\n\n';
          mailText += 'You have been invited to join Humanitarian ID - a neutral humanitarian login and contact management system for humanitarian responders. In order to add your details and connect with other responders, please register using the link below.\n\n';
          mailText += reset_url + '\n\n';
          mailText += 'The Humanitarian ID team\n';
          mailText += 'http://humanitarian.id\n\n\n';

          mailText += 'Bonjour ' + nameGiven + ',\n\n';
          mailText += 'Vous avez été invitez à joindre Humanitarian ID – un système autonome pour gérer les contacts des acteurs humanitaires. Pour ajouter vos détails et pour rentrer en contact avec autres humanitaires, on vous prie de bien vouloir vous enregistrer en utilisant le lien ci-dessous.\n\n';
          mailText += reset_url + '\n\n';
          mailText += 'L’équipe Humanitarian ID\n';
          mailText += 'http://humanitarian.id';
          break;

        case 'reset':
        default:
          mailSubject = 'Password reset for Humanitarian ID';

          mailText = 'Dear ' + nameGiven + ',\n\n';
          mailText += 'We received a request to reset your password on Humanitarian ID. To make the change, simply follow the link below and provide your new password.\n\n';
          mailText += 'If you did not request a password reset, kindly forward this email to ' + config.emailer.from + '.\n\n';
          mailText += reset_url + '\n\n';
          mailText += 'The Humanitarian ID team\n';
          mailText += 'http://humanitarian.id\n\n\n';

          mailText += 'Bonjour ' + nameGiven + ',\n\n';
          mailText += 'On a reçu une requête indiquant que vous voulez renouveler votre mot de passe sur Humanitarian ID. En cliquant sur le lien ci-dessous vous pouvez changer votre mot de passe.\n\n';
          mailText += 'Si vous n’avez pas faites cette requête, on vous prie de nous faire suivre ce courriel à l’adresse de ' + config.emailer.from + '.\n\n';
          mailText += 'L’équipe Humanitarian ID\n';
          mailText += 'http://humanitarian.id';
          break;
      }

      var mailOptions = {
        from: 'Humanitarian ID <' + config.emailer.from + '>',
        to: email,
        subject: mailSubject,
        text: mailText
      };

      // Send mail
      mail.sendMail(mailOptions, function(error, info) {
        if (error) {
          message = 'Password reset email sending failed. Please try again or contact administrators.';
          log.warn({'type': 'resetPassword:error', 'message': 'Error occurred while sending password reset email for ' + email + ' (for client ' + clientId + ').', 'error': error, 'info': info, 'mailOptions': mailOptions});
          return cb(true);
        }
        else {
          message = 'Sending password successful! Check your email and follow the included link to reset your password.';
          log.warn({'type': 'resetPassword:success', 'message': 'Reset password email sent successfully to ' + email + ' (for client ' + clientId + ').', 'info': info, 'mailOptions': mailOptions, 'resetUrl': reset_url});
          return cb();
        }
      });
    }
  ],
  function (err, results) {
    callback(err, {status: (!err) ? 'ok' : 'error', message: message});
  });
};
