var express = require('express');
var routes = require('./routes');
var config = require('./config');
var path = require('path');
var models = require('./models');
var middleware = require('./middleware');
var csrf = require('csurf')();
var cors = require('cors');
var app = express();
var oauthserver = require('oauth2-server');
var User = models.User;

app.set('env', process.env.NODE_ENV || 'development');
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.cookieParser('ncie0fnft6wjfmgtjz8i'));
app.use(express.cookieSession());

app.set('title', 'Humanitarian ID');
app.locals.title = 'Humanitarian ID';
app.set('emailFrom', 'info@humanitarian.id');

app.configure('development', 'production', function() {
  app.use(express.logger('dev'));
});

app.use(express.bodyParser());
app.use(express.methodOverride());

var formCSRF = function (req, res, next) {
  // Skip CSRF validation on the /oauth/access_token callback, as it's not based
  // on a form submission.
  if (req.path == '/oauth/access_token' || req.path.substr(0, 5) == '/api/') {
    next();
  } else {
    csrf(req, res, next);
  }
};
app.use(formCSRF);

app.oauth = oauthserver({
  model: models.oauth,
  grants: ['password', 'authorization_code', 'refresh_token'],
  debug: true
});

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(err, req, res, next) {
  if (process.env.NODE_ENV !== 'test')
    console.error('Error:', err);

  if (middleware.isValidationError(err)) {
    res.status(400);
    res.send(err.errors);
  } else {
    res.status(err.code || 500);
    res.send('Error');
  }
});

if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', middleware.loadUser, routes.index);

app.all('/oauth/access_token', app.oauth.grant());

app.get('/oauth/authorize', function(req, res, next) {
  // If a nonce value is provided, add it to the session to support either
  // authorization route as well as the redirect through login.
  if (req.query.nonce && req.query.nonce.length) {
    req.session.nonce = req.query.nonce;
  }

  // If the user is not authenticated, redirect to the login page and preserve
  // all relevant query parameters.
  if (!req.session.userId) {
    console.log('Accessing /oauth/authorize without session. Redirecting to the login page.');
    return res.redirect('/?redirect=' + req.path + '&client_id=' + req.query.client_id + '&redirect_uri=' + req.query.redirect_uri + '&response_type=' + req.query.response_type + '&state=' + req.query.state + '&scope=' + req.query.scope + '#login');
  }

  // If the user is authenticated, then check whether the user has confirmed
  // authorization for this client/scope combination.
  User.findOne({email: req.session.userId}, function (err, doc) {
    var clientId = req.query.client_id,
      scope = req.query.scope;

    if (err) {
      next(new Error('Error occurred while fetching the user record for ' + req.session.userId));
    }
    else if (doc && doc.authorized_services && doc.authorized_services.hasOwnProperty(clientId) && doc.authorized_services[clientId].indexOf(scope) !== -1) {
      // The user has confirmed authorization for this client/scope.
      // Proceed with issuing an auth code (see POST /oauth/authorize).
      app.oauth.authCodeGrant(function (_req, verify) {
        verify(null, true, _req.session.userId);
      })(req, res, next);
    }
    else {
      // The user has not confirmed authorization, so present the
      // authorization page.
      res.render('authorize', {
        client_id: req.query.client_id,
        redirect_uri: req.query.redirect_uri,
        response_type: req.query.response_type || 'code',
        scope: req.query.scope || '',
        csrf: req.csrfToken()
      });
    }
  });
});

app.post('/oauth/authorize', function(req, res, next) {
  // If the user is not authenticated, redirect to the login page.
  if (!req.session.userId) {
    console.log('Posting to /oauth/authorize without session. Redirecting to the login page.');
    return res.redirect('/');
  }

  next();
}, app.oauth.authCodeGrant(function(req, next) {
  // Invoke next() to return the authorization decision.
  // The first param should indicate an error
  // The second param should indicate if the user did authorize the app
  // The third param should be the user/uid (only used for passing to saveAuthCode)
  if (req.body.allow === 'yes') {
    // If the user confirmed authorization for this client/scope, then add
    // this authorization to the user's record so this can be skipped.
    User.findOne({email: req.session.userId}, function (err, doc) {
      var clientId = req.body.client_id,
        scope = req.body.scope;

      if (!doc.authorized_services) {
        doc.authorized_services = {};
      }
      if (!doc.authorized_services.hasOwnProperty(clientId)) {
        doc.authorized_services[clientId] = [];
      }
      if (scope && scope.length && doc.authorized_services[clientId].indexOf(scope) === -1) {
        //TODO: validate scope values
        doc.authorized_services[clientId].push(scope);
        doc.markModified('authorized_services');
        doc.save();
      }
      next(null, true, req.session.userId);
    });
  }
  else {
    // If the user did not confirm authorization for the client/scope, then
    // cancel the authorization process.
    next(null, false, req.session.userId);
  }
}));

app.use(app.oauth.errorHandler());

app.all('/account', middleware.requiresUser, routes.users.account);
app.get('/account.json', cors(), middleware.requiresUser, routes.users.showjson);

app.post('/register', routes.register.form);
app.post('/login', routes.session.create);
app.post('/resetpw', routes.users.resetpw);
app.get('/resetpw/:key', routes.users.resetpwuse);
app.get('/register/:key', routes.users.resetpwuse);

app.all('/logout', function (req, res) {
  console.log('Clearing session to log out user ' + req.session.userId);
  req.session = null;
//TODO: add validation for redirect based on client ID
  var redirect = (req.query.redirect && String(req.query.redirect).length) ? req.query.redirect : '/';
  res.redirect(redirect);
});

app.post('/api/register', middleware.requiresKeySecret, routes.api.register);

module.exports = app;
