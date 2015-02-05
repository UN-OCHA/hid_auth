var User = require('./../models').User;

module.exports.create = function(req, res, next) {
  User.authenticate(req.body.email, req.body.password, function(err, user) {
    if (err) return next(err);

    if (user) {
      req.session.userId = user.email;
      var redirect = req.body.redirect || '/account';
      redirect += "?client_id=" + req.body.client_id;
      redirect += "&redirect_uri=" + req.body.redirect_uri;
      redirect += "&response_type=" + req.body.response_type;
      redirect += "&state=" + req.body.state;
      redirect += "&scope=" + req.body.scope;
      console.log('Authentication successful for ' + req.body.email + '. Redirecting to: ' + redirect);
      res.redirect(redirect);
    }
    else {
      console.log('Authentication failed for ' + req.body.email);
      res.status(401).render('index', {
        message: 'Authentication failed. Do you need to confirm your account or <a class="forgot-password" href="#">reset your password?</a>',
        client_id: req.body.client_id || '',
        redirect: req.body.redirect || '',
        redirect_uri: req.body.redirect_uri || '',
        response_type: req.body.response_type || '',
        state: req.body.state || '',
        scope: req.body.scope || '',
        csrf: req.csrfToken()
      });
    }
  });
};
