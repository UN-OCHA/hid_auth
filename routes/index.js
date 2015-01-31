exports.index = function(req, res) {
  if (req.session.userId) {
    res.redirect('account');
  }
  else {
    req.session.redirect = req.session.redirect || req.query.redirect || '';
    req.session.clientId = req.session.clientId || req.query.client_id || '';
    req.session.redirectUri = req.session.redirectUri || req.query.redirect_uri || '';
    res.render('index', {
      redirect: req.query.redirect || '',
      client_id: req.query.client_id || '',
      redirect_uri: req.query.redirect_uri || '',
      response_type: req.query.response_type || '',
      state: req.query.state || '',
      scope: req.query.scope || '',
      csrf: req.csrfToken()
    });
  }
};

exports.register = require('./register');
exports.session = require('./session');
exports.users = require('./users');
exports.api = require('./api');
