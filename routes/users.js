var User = require('./../models').User;
var errors = require('./../errors');

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
