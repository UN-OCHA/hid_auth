var models = require('./../models'),
    User = models.User,
    config = require('./../config'),
    mail = require('./../mail');

function sendReminderVerifyEmails(cb) {
  console.log('INFO: sending reminder emails to verify addresses');
  var stream = User.find({'active': 0}).stream();

  stream.on('data', function(user) {
    if (user.shouldSendReminderVerify()) {
      this.pause();
      var now = Date.now(),
        clientId = config.defaultClient || 'hid-prod',
        reset_url = config.rootURL;

      reset_url += "/register/" + new Buffer(user.email + "/" + now + "/" + new Buffer(User.hashPassword(user.hashed_password + now + user.user_id)).toString('base64') + "/" + clientId).toString('base64');

      var mailOptions = {
        to: user.email,
        subject: 'Remember to verify your email',
        first_name: user.name_given,
        verify_link: reset_url 
      };

      // Send mail
      var self = this;
      mail.sendTemplate('reminder_verify', mailOptions, function (err, info) {
        if (!err) {
          console.log('INFO: sent reminder verify email to ' + user.email);
          // set reminded_verify date
          user.reminded_verify = now.valueOf();
          user.save();
        }
        else {
          console.log(err);
        }
        self.resume();
      });
    }
  });

  stream.on('close', function () {
    cb();
  });
}

exports.sendReminderVerifyEmails = sendReminderVerifyEmails;

