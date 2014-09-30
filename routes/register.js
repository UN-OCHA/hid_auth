var User = require('./../models').User;
var mail = require('./../mail');

module.exports.form = function(req, res, next) {
  var options = req.body || {},
    message = null;

  if (options.email) {
    password = 'abc123';
    options.password = password;
//TODO: test for existing user
    User.register(options, function (err, data) {
      message = 'Account successfully created. Initial password set to: ' + password;
      options = {};

      if (err) {
        res.render('index', {options: options, message: message, csrf: req.csrfToken()});
        return next(true);
      }
      else {
        // setup e-mail data
        var now = Date.now(),
          reset_url = "resetpw/" + new Buffer(data.email + "/" + now + "/" + new Buffer(User.hashPassword(data.hashed_password + now + data.user_id)).toString('base64')).toString('base64');
        var mailText = 'Use link to verify your account: ' + reset_url;
        var mailOptions = {
          from: 'Contacts ID <info@contactsid.local>',
          to: data.email,
          subject: 'Account verify link for Contacts ID',
          text: mailText
        };
        
        // send mail with defined transport object
        mail.sendMail(mailOptions, function(error, info){
          var message;
          if (error) {
            console.log(error);
            message = 'Verify email sending failed.';
          }
          else {
            console.log('Message sent: ' + info.response);
            message = 'Verify email sent successful! Check your email and follow the included link to reset your password.';
          }
          res.render('index', {options: options, message: message, csrf: req.csrfToken()});
          next();
        });

      }


    });
    return;
  }
  else if (req.body) {
    message = 'An email address is required to register a new account.';
  }
  res.render('index', {options: options, message: message, csrf: req.csrfToken()});
};
