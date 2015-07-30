var log = require('./../log');
var mail = require('./../mail');

function send(message, subject, req) {
  if (req.app.get('env') != 'production' && req.app.get('env') != 'prod') {
    subject = '[' + req.app.get('env') + '] ' + subject;
  }

  var mailOptions = {
    from: req.app.get('title') + ' <' + req.app.get('emailFrom') + '>',
    //to: 'info+@humanitarian.id',
    to: 'aross@phase2technology.com',
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
