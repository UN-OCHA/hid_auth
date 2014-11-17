var express = require('express');
var routes = require('./routes');
var config = require('./config');
var path = require('path');
var models = require('./models');
var middleware = require('./middleware');
var csrf = require('csurf')();
var app = express();
var oauthserver = require('node-oauth2-server');
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
}
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
  if (req.query.nonce && req.query.nonce.length) {
    req.session.nonce = req.query.nonce;
  }

  if (!req.session.userId) {
    console.log('Accessing /oauth/authorize without session. Redirecting to the login page.');
    return res.redirect('/?redirect=' + req.path + '&client_id=' +
      req.query.client_id + '&redirect_uri=' + req.query.redirect_uri);
  }

  res.render('authorize', {
    client_id: req.query.client_id,
    redirect_uri: req.query.redirect_uri,
    csrf: req.csrfToken()
  });
});

app.post('/oauth/authorize', function(req, res, next) {
  if (!req.session.userId) {
    console.log('Posting to /oauth/authorize without session. Redirecting to the login page.');
    return res.redirect('/?redirect=' + req.path + 'client_id=' +
      req.query.client_id +'&redirect_uri=' + req.query.redirect_uri);
  }

  next();
}, app.oauth.authCodeGrant(function(req, next) {
  // The first param should to indicate an error
  // The second param should a bool to indicate if the user did authorize the app
  // The third param should for the user/uid (only used for passing to saveAuthCode)
  next(null, req.body.allow === 'yes', req.session.userId, null);
}));

app.use(app.oauth.errorHandler());

app.all('/account', middleware.requiresUser, routes.users.account);
app.get('/account.json', middleware.requiresUser, routes.users.showjson);

app.post('/register', routes.register.form);
app.post('/login', routes.session.create);
app.post('/resetpw', routes.users.resetpw);
app.get('/resetpw/:key', routes.users.resetpwuse);

app.all('/logout', function (req, res) {
  console.log('Clearing session to log out user ' + req.session.userId);
  req.session = null;
//TODO: add validation for redirect based on client ID
  var redirect = (req.query.redirect && String(req.query.redirect).length) ? req.query.redirect : '/';
  res.redirect(redirect);
});

app.post('/api/register', middleware.requiresKeySecret, routes.api.register);

module.exports = app;
