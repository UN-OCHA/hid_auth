var User = require('./../models').User;

module.exports.create = function(req, res, next) {
  User.authenticate(req.body.email, req.body.password, function(err, user) {
    if (err) return next(err);

    if (user) {
      req.session.userId = user.email;
      var redirect = (req.query.redirect != null ? req.query.redirect : '/account');
      redirect += "?client_id=" + req.query.client_id;
      redirect += "&redirect_uri=" + req.query.redirect_uri;
      res.redirect(redirect);
    } else {
      console.log('Authentication failed for ' + req.body.email);
      res.status(401).render('login', {client_id: req.query.client_id, message: 'Authentication failed', csrf: req.csrfToken()});
    }
  });
};

module.exports.show = function(req, res, next) {
  res.render('login', {client_id: req.query.client_id, csrf: req.csrfToken()});
};
