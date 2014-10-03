var User = require('./../models').User;

module.exports.create = function(req, res, next) {
  User.authenticate(req.body.email, req.body.password, function(err, user) {
    if (err) return next(err);

    if (user) {
      req.session.userId = user.email;
      var redirect = (req.body.redirect != null && req.body.redirect != undefined) ? req.body.redirect : '/account';
      redirect += "?client_id=" + req.body.client_id;
      redirect += "&redirect_uri=" + req.body.redirect_uri;
      console.log('Authentication successful for ' + req.body.email);
      res.redirect(redirect);
    }
    else {
      console.log('Authentication failed for ' + req.body.email);
      res.status(401).render('index', {client_id: req.query.client_id, message: 'Authentication failed', csrf: req.csrfToken()});
    }
  });
};
