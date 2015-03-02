var async = require('async'),
  log = require('./../log'),
  User = require('./../models').User,
  config = require('./../config'),
  mail = require('./../mail');

exports.register = function(req, res) {
  var status = 'error',
    email,
    nameLast,
    nameFirst,
    active,
    emailFlag,
    adminName,
    data = {};

  var hashed_password = "";

  async.series([
    function (cb) {
      // Check inputs
      if (!req.body.email || !req.body.email.length) {
        log.warn({'type': 'apiRegister:error', 'message': 'api/register method called without email address by client ' + req.client_key});
        return cb(true);
      }
      if (!req.body.nameLast || !req.body.nameLast.length) {
        log.warn({'type': 'apiRegister:error', 'message': 'api/register method called without last name by client ' + req.client_key});
        return cb(true);
      }
      if (!req.body.nameFirst || !req.body.nameFirst.length) {
        log.warn({'type': 'apiRegister:error', 'message': 'api/register method called without first name by client ' + req.client_key});
        return cb(true);
      }
      email = req.body.email;
      nameLast = req.body.nameLast;
      nameFirst = req.body.nameFirst;
      adminName = req.body.adminName || null;
      active = req.body.active || 0
      emailFlag = req.body.emailFlag || false;

      // Check if email is already registered.
      User.findOne({email: req.body.email}, function (err, user) {
        if (err) {
          log.warn({'type': 'apiRegister:error', 'message': 'api/register encountered error on User.findOne for email ' + req.body.email + ' by client ' + req.client_key});
          return cb(true);
        }

        if (user && user.user_id) {
          status = 'ok';
          data = {
            user_id: user.user_id,
            is_new: 0
          };
          log.info({'type': 'apiRegister', 'message': 'api/register called for registered user with email ' + req.body.email + ' by client ' + req.client_key});
          return cb(true);
        }
        else {
          return cb();
        }
      });
    },
    function (cb) {
      // If no user exists, register the user.
      var options = {
        email: email,
        name_given: nameFirst,
        name_family: nameLast,
        active: active
      },
      password = User.hashPassword(email + Date.now() + nameLast + nameFirst),
      pos = Math.floor(Math.random() * (password.length - 12));
      password = password.substr(pos, 12);
      options.password = password;

      // Register the account
      User.register(options, function (err, user) {
        if (err || !user) {
          message = 'api/register Account registration failed. Please try again or contact administrators.';
          log.warn({'type': 'apiRegister:error', 'message': 'api/register Account registration failed on User.register for email ' + email + ' by client ' + req.client_key});
          return cb(true);
        }
        status = 'ok';
        hashed_password = user.hashed_password;
        data = {
          user_id: user.user_id,
          is_new: 1
        };
        log.info({'type': 'apiRegister:success', 'message': 'api/register Account registration success for user with email ' + email + ' by client ' + req.client_key});
        return cb();
      });

    },
    function (cb){
      //Send email for ghost accounts
      if (emailFlag == '1'){
        // Set up email content
        var subject = '';
        var now = Date.now(),
          clientId = req.body.client_id || '';
          reset_url = config.rootURL || (req.protocol + "://" + req.get('host'));

        reset_url += "/register/" + new Buffer(email + "/" + now + "/" + new Buffer(User.hashPassword(hashed_password + now + data.user_id)).toString('base64') + "/" + clientId).toString('base64');

        var mailText = 'Dear ' + nameFirst + ', \r\n\r\nYou have been invited to join Humanitarian ID -  a neutral humanitarian login and contact management system for humanitarian responders. In order to add your details and connect with other responders, please register using the link below.';
        mailText += '\r\n\r\nBonjour ' + nameFirst + ', \r\n\r\nVous avez été invitez à joindre Humanitarian ID – un système autonome pour gérer les contacts des acteurs humanitaires. Pour ajouter vos détails et pour rentrer en contact avec autres humanitaires, on vous prie de bien vouloir vous enregistrer en utilisant le lien ci-dessous.';
        mailText += '\r\n\r\n' + reset_url;
        mailText += '\r\n\r\nThe Humanitarian ID team\r\nhttp://humanitarian.id';
        
        if (!adminName){
          subject = 'Account verify link for ' + req.app.get('title');
        }
        else{
          subject = adminName + ' has invited you to join Humanitarian ID';
        }
        var mailOptions = {
          from: req.app.get('title') + ' <' + req.app.get('emailFrom') + '>',
          to: email,
          subject: subject,
          text: mailText
        };

        // Send mail
        mail.sendMail(mailOptions, function (err, info) {
          if (err) {
            message = 'Verify email sending failed. Please try again or contact administrators.';
            log.warn({'type': 'registerEmail:error', 'message': 'Registration verification email sending failed to ' + data.email + '.', 'err': err, 'info': info});
            return cb(true);
          }
          else {
            message = 'Verify email sent successful! Check your email and follow the included link to verify your account.';
            log.info({'type': 'registerEmail:success', 'message': 'Registration verification email sending successful to ' + data.email + '.', 'info': info, 'resetUrl': reset_url});
            options = {};
            return cb();
          }
        });
      }
      else{
        return cb();
      }
    },
  ], function (err) {
    res.send(JSON.stringify({status: status, data: data}));
  });
}

exports.resetpw = function(req, res) {
  var status = 'error',
    email,
    emailFlag,
    clientId,
    data = {};

  async.series([
    function (cb) {
      // Check inputs
      clientId = req.client_key || '';
      if (!req.body.email || !req.body.email.length) {
        log.warn({'type': 'apiResetPw:error', 'message': 'api/register method called without email address by client ' + clientId});
        return cb(true);
      }
      email = req.body.email;
      emailFlag = req.body.emailFlag || false;
      return cb();
    },
    function (cb) {
      // Use lib/passwordReset.js and pass through the email flag if given.
      require('./../lib/passwordReset').passwordReset(email, clientId, emailFlag, cb);
    },
  ], function (err, results) {
    res.send(JSON.stringify(results[1] || {'status': 'error', 'message': 'An error occurred processing the request.'}));
  });
}
