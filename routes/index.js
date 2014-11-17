exports.index = function(req, res) {
  if (req.session.userId) {
    res.redirect('account');
  }
  else {
    req.session.returnURI = req.query.return_uri || '';
    res.render('index', {redirect: req.query.redirect || '', client_id: req.query.client_id, redirect_uri: req.query.redirect_uri || '', csrf: req.csrfToken()});
  }
};

exports.register = require('./register');
exports.session = require('./session');
exports.users = require('./users');
exports.api = require('./api');
