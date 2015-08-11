var log = require('./../log');
var mail = require('./../mail');
var config = require('./../config');

function mailOptions(message, subject, destination, req) {
  if (req.app.get('env') != 'production' && req.app.get('env') != 'prod') {
    subject = '[' + req.app.get('env') + '] ' + subject;
  }

  var mailOptions = {
    from: req.app.get('title') + ' <' + req.app.get('emailFrom') + '>',
    to: destination,
    subject: subject,
    text: message
  };

  return mailOptions;
}

function admin(message, subject, req) {
  var options = mailOptions(message, subject, process.env.HID_AUTH_ADMIN_EMAIL || config.emailer.admin, req);

  if (!options.to) {
    log.info({'type': 'alert:mail:warning', 'mail': options}, 'Destination address not sent for administrative notification. Skipping.');
  }

  mail.sendMail(options, function (err, info) {
    if (err) {
      log.warn({'type': 'alert:mail:error', 'err': err, 'info': info}, 'Failed to send alert email to administrators.');
    }
    else {
      log.info({'type': 'alert:mail:success', 'info': info}, 'Sent alert email to administrators.');;
    }
  });
}

function user(message, subject, user, req) {
  var options = mailOptions(message, subject, user.email, req);

  mail.sendMail(options, function (err, info) {
    if (err) {
      log.warn({'type': 'alert:mail:error', 'err': err, 'info': info}, 'Failed to send alert email to user');
    }
    else {
      log.info({'type': 'alert:mail:success', 'info': info}, 'Sent alert email to user');
    }
  });
}

module.exports.admin = admin;
module.exports.user = user;
