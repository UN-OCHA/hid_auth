var models = require('./../models'),
    User = models.User,
    mail = require('./../mail'),
    restify = require('restify'),
    middleware = require('./../middleware');

function sendReminderVerifyEmails(cb) {
  console.log('INFO: sending reminder emails to verify addresses');
  var stream = User.find({'active': 0}).stream();

  stream.on('data', function(user) {
    if (user.shouldSendReminderVerify()) {
      this.pause();

      var self = this;
      // Make sure user is not an orphan
      // An orphan will have a contact on the profiles side, while a non-orphan will not, so make sure
      // the user does not have a contact on the profiles side.
      var request = {
          "email.address": user.email
      };
      var new_access_key = middleware.getProfilesAccessKey(request);

      var client = restify.createJsonClient({
        url: process.env.PROFILES_URL,
        version: '*'
      });
      client.get("/v0/contact/view?_access_key=" + new_access_key.toString() + "&_access_client_id=" + process.env.PROFILES_CLIENT_ID + "&email.address=" + user.email.trim(), function (err, req, res, data) {
        client.close();
        if (res.statusCode == 200 && res.body) {
          var obj = JSON.parse(res.body);
          if (obj.status && obj.status == 'error') {
            // There was an error. Do not send anything.
            self.resume();
          }
          else {
            if (typeof obj.count != undefined && obj.count === 0) {
              // Send mail
              var now = Date.now(),
              clientId = process.env.DEFAULT_CLIENT || 'hid-prod',
              reset_url = process.env.ROOT_URL;

              reset_url += "/register/" + new Buffer(user.email + "/" + now + "/" + new Buffer(User.hashPassword(user.hashed_password + now + user.user_id)).toString('base64') + "/" + clientId).toString('base64');

              var mailOptions = {
                to: user.email,
                subject: 'Remember to confirm your account on Humanitarian ID',
                first_name: user.name_given,
                verify_link: reset_url
              };

              // Send mail
              mail.sendTemplate('reminder_verify', mailOptions, function (err, info) {
                if (!err) {
                  console.log('INFO: sent reminder verify email to ' + user.email);
                  var times = user.times_reminded_verify || 0;
                  // set reminded_verify date
                  user.reminded_verify = now.valueOf();
                  user.times_reminded_verify = times + 1;
                  user.save();
                }
                else {
                  console.log(err);
                 }
                self.resume();
              });
            }
            else {
              self.resume();
            }
          }
        }
        else {
          self.resume();
        }
      });
    }
  });

  stream.on('close', function () {
    cb();
  });
}

// Remove accounts which have expired (never been claimed)
function deleteExpired(cb) {
  console.log('INFO: delete expired accounts');
  var stream = User.find({'expires': true}).stream();

  stream.on('data', function(user) {
    if (user.isExpired()) {
      user.remove();
    }
  });

  stream.on('close', function() {
    cb();
  });
}


exports.sendReminderVerifyEmails = sendReminderVerifyEmails;
exports.deleteExpired = deleteExpired;
