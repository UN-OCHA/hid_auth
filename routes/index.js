exports.index = function(req, res) {
  if (req.session.userId) {
    res.redirect('account');
  }
  else {
    req.session.redirect = req.session.redirect || req.query.redirect || '';
    req.session.clientId = req.session.clientId || req.query.client_id || '';
    req.session.redirectUri = req.session.redirectUri || req.query.redirect_uri || '';
    res.render('index', {
      message: '',
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

exports.admin = function(req, res) {
  var message = '';

  res.render('adminIndex', {
    user: req.user,
    message: message,
    pages: [
      {
        label: 'Administrate Users',
        path: 'admin/users',
        description: 'Administer user accounts, including promotion to or demotion from administrative status.'
      },
      {
        label: 'Administrate Apps',
        path: 'admin/apps',
        description: 'Administer application keys, including registering and revoking access.'
      }
    ]
  });
};

exports.register = require('./register');
exports.session = require('./session');
exports.users = require('./users');
exports.adminUsers = require('./adminUsers');
exports.adminApps = require('./adminApps');
exports.api = require('./api');
