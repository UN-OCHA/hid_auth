exports.index = function(req, res) {
  if (req.session.userId) {
    res.redirect('account');
  }
  else {
    req.session.returnURI = req.query.return_uri || '';
    req.session.returnApp = req.query.return_app || '';
    res.render('index', {
      redirect: req.query.redirect || '',
      client_id: req.query.client_id,
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
