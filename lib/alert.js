var log = require('./../log');
var mail = require('./../mail');
var config = require('./../config');

function send(message, subject, req) {
  if (req.app.get('env') != 'production' && req.app.get('env') != 'prod') {
    subject = '[' + req.app.get('env') + '] ' + subject;
  }

  var mailOptions = {
    from: req.app.get('title') + ' <' + req.app.get('emailFrom') + '>',
    to: process.env.HID_AUTH_ADMIN_EMAIL || config.emailer.admin,
    subject: subject,
    text: message
  };

  mail.sendMail(mailOptions, function (err, info) {
    if (err) {
      log.warn({'type': 'alert:mail:error', 'err': err, 'info': info}, 'Failed to send alert email to administrators.');
    }
    else {
      log.info({'type': 'alert:mail:success', 'info': info}, 'Sent alert email to administrators.');;
    }
  });
}

module.exports.send = send;
