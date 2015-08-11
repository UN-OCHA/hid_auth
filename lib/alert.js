var log = require('./../log');
var mail = require('./../mail');
var config = require('./../config');

function mailOptions(options, subject, destination, req) {
  if (req.app.get('env') != 'prod') {
    subject = '[' + req.app.get('env') + '] ' + subject;
  }

  options.from = req.app.get('title') + ' <' + req.app.get('emailFrom') + '>';
  options.to = destination;
  options.subject = subject;

  return options;
}

function admin(locals, subject, req) {
  var options = mailOptions(locals, subject, process.env.HID_AUTH_ADMIN_EMAIL || config.emailer.admin, req);

  if (!options.to) {
    log.info({'type': 'alert:mail:warning', 'mail': options}, 'Destination address not sent for administrative notification. Skipping.');
  }

  mail.sendTemplate('lock_alert_admin', options, function (err, info) {
    if (err) {
      log.warn({'type': 'alert:mail:error', 'err': err, 'info': info}, 'Failed to send alert email to administrators.');
    }
    else {
      log.info({'type': 'alert:mail:success', 'info': info}, 'Sent alert email to administrators.');;
    }
  });
}

function user(locals, subject, user, req) {
  var options = mailOptions(locals, subject, user.email, req);

  mail.sendTemplate('lock_alert', options, function (err, info) {
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
