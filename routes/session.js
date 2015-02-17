var User = require('./../models').User;
var log = require('./../log');

module.exports.create = function(req, res) {
  User.authenticate(req.body.email, req.body.password, function(err, user) {
    if (err) {
      return next(err);
    }

    if (user) {
      req.session.userId = user.email;
      var redirect = req.body.redirect || '/account';
      redirect += "?client_id=" + req.body.client_id;
      redirect += "&redirect_uri=" + req.body.redirect_uri;
      redirect += "&response_type=" + req.body.response_type;
      redirect += "&state=" + req.body.state;
      redirect += "&scope=" + req.body.scope;
      res.redirect(redirect);
      log.info({'type': 'authenticate:success', 'message': 'Authentication successful for ' + req.body.email + '. Redirecting to ' + redirect, 'user': user});
    }
    else {
      res.status(401).render('index', {
        message: 'Authentication failed. Do you need to confirm your account or <a class="forgot-password" href="#forgotPass">reset your password?</a>',
        client_id: req.body.client_id || '',
        redirect: req.body.redirect || '',
        redirect_uri: req.body.redirect_uri || '',
        response_type: req.body.response_type || '',
        state: req.body.state || '',
        scope: req.body.scope || '',
        csrf: req.csrfToken()
      });
      log.info({'type': 'authenticate:error', 'message': 'Authentication failed for ' + req.body.email + '.', 'user': user});
    }
  });
};
