var User = require('./../models').User;
var errors = require('./../errors');
var bcrypt = require('bcrypt');

module.exports.account = function(req, res, next) {
  User.findOne({email: req.session.userId}, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new errors.NotFound('User not found'));

    var options = req.body || {},
      message = null,
      redirect_uri = req.query.redirect_uri || req.body.redirect_uri || '';

    if (options.pass_current) {
      // Validate the password
      User.authenticate(user.email, options.pass_current, function(err, result) {
        if (result) {
          // If correct, allow to continue
        }
        else {
          // If incorrect, show an error
        }
      });
    }
    else {
      // Remove fields that should not be changed without a valid password.
      delete options.email;
      delete options.email_recovery;
      delete options.pass_new;
      delete options.pass_confirm;
    }

    // Update any fields
    var changed = false;
    for (var key in options) {
      if (options.hasOwnProperty(key)) {
        user[key] = options[key];
        changed = true;
      }
    }
    if (changed) {
      return user.save(function (err, item) {
        message = 'Settings successfully saved.';
        if (redirect_uri && redirect_uri != undefined && String(redirect_uri).length) {
          console.log('redirect uri is ' + redirect_uri);
          res.redirect(redirect_uri);
        }
        else {
          res.render('account', {user: user, message: message, redirect_uri: redirect_uri, csrf: req.csrfToken()});
        }
      });
    }

    res.render('account', {user: user, message: message, redirect_uri: redirect_uri, csrf: req.csrfToken()});
  });
};

module.exports.showjson = function(req, res, next) {
  User.findOne({email: req.user.id}, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new errors.NotFound('showjson: User not found for ' + req.session.userId, req.session));

    // Remove sensitive fields. The delete operator did not work.
    user.hashed_password = undefined;
    user.email_recovery = undefined;
    user._id = undefined;
    user.__v = undefined;

    // Return the JSON serialized user object
    res.send(JSON.stringify(user));
    return next();
  });
};

module.exports.resetpw = function(req, res, next) {
  var email = (req.body && req.body.email) ? req.body.email : undefined;

  if (email == undefined || !String(email).length) {
    res.render('index', {action: 'help', message: "An email address is required to reset an account's password.", csrf: req.csrfToken()});
    return next(new errors.BadRequest("Email address is required to reset an account's password."));
  }

  User.findOne({email: email}, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new errors.NotFound('User not found'));
//TODO: check recovery email

    var message = null,
      redirect_uri = req.query.redirect_uri || req.body.redirect_uri || '',
      now = Date.now(),
      reset_url = "resetpw/" + new Buffer(user.email + "/" + now + "/" + new Buffer(User.hashPassword(user.hashed_password + now + user.user_id)).toString('base64')).toString('base64');

    message = 'Use password reset link: ' + reset_url;
    res.render('index', {user: user, message: message, redirect_uri: redirect_uri, csrf: req.csrfToken()});
  });
};

module.exports.resetpwuse = function(req, res, next) {
  var encodedKey = (req.params && req.params.key) ? req.params.key : undefined;

  if (encodedKey != undefined && String(encodedKey).length) {
    // decode key
    var key = new Buffer(encodedKey, 'base64').toString('ascii'),
      parts = key.split('/'),
      email = parts[0],
      timestamp = parts[1],
      hash = new Buffer(parts[2], 'base64').toString('ascii');

    // verify timestamp is not too old
    if (timestamp < (Date.now() - 5184000) || timestamp > Date.now()) {
      next(true);
    }

    // look up user
    User.findOne({email: email}, function(err, user) {
      if (err) return next(err);
      if (!user) return next(new errors.NotFound('User not found'));

      // verify hash
      if (!bcrypt.compareSync(user.hashed_password + timestamp + user.user_id, hash)) {
        return next(new errors.BadRequest('Invalid password reset link.'));
      }

      // log operation
      console.log('valid password link for ' + email + '. initiating session');

      // register session
      req.session.userId = user.email;

      // redirect to account page to change password
      res.redirect('account');
    });
  }
};
