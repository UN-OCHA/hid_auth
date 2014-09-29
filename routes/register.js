var User = require('./../models').User;

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
      res.render('register', {options: options, message: message, csrf: req.csrfToken()});
    });
    return;
  }
  else if (req.body) {
    message = 'An email address is required to register a new account.';
  }
  res.render('register', {options: options, message: message, csrf: req.csrfToken()});
};
