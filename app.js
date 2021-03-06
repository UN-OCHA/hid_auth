var routes = require('./routes');
var errors = require('./errors');
var log = require('./log');
var path = require('path');
var models = require('./models');
var middleware = require('./middleware');
var User = models.User;
var Client = models.OAuthClientsModel;

// Set http and https default maxSockets to Infinity to avoid artificial
// constraints in Node < 0.12.
var http = require('http');
http.globalAgent.maxSockets = Infinity;
var https = require('https');
https.globalAgent.maxSockets = Infinity;

var express = require('express');
var paginate = require('express-paginate');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var multer = require('multer');
var methodOverride = require('method-override');
var serveStatic = require('serve-static');
var logger = require('morgan');
var helmet = require('helmet');
var csrf = require('csurf')();
var cors = require('cors');
var MongoStore = require('connect-mongo')(session);
var oauthserver = require('oauth2-server');
var i18n = require('i18n-2');
var requestLanguage = require('express-request-language');

var app = express();
app.set('env', process.env.NODE_ENV || 'development');
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(cookieParser());
var mstore = new MongoStore({
  mongooseConnection: models.mongoose.connection,
  touchAfter: 6 * 3600 // refresh session document every 6 hours
});
app.use(session({
  key: 'hid.auth',
  store: mstore,
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,
  resave: false
}));

app.set('title', 'Humanitarian ID');
app.locals.title = 'Your Humanitarian ID login';
app.set('emailFrom', 'info@humanitarian.id');

// Attach the i18n property to the express request object
// And attach helper methods for use in templates
i18n.expressBind(app, {
  // setup some locales - other locales default to en silently
  locales: ['en', 'fr'],
});

app.use(requestLanguage({
  languages: ['en', 'fr']
}));

// This is how you'd set a locale from req.cookies.
// Don't forget to set the cookie either on the client or in your Express app.
app.use(function(req, res, next) {
  req.i18n.setLocale(req.language);
  next();
});

// Define Oauth token expiration time to 8 hours.
var oauthTokenExpires = 28800;

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(methodOverride());

app.use(helmet());
// Set Strict-Transport-Security header to 4 weeks (in milliseconds)
app.use(helmet.hsts({maxAge: 2419200000, force: process.env.REQUIRE_SSL ? true : false}));

var formCSRF = function (req, res, next) {
  // Skip CSRF validation on the /oauth/access_token callback, as it's not based
  // on a form submission.
  if (req.path == '/oauth/access_token' || req.path == '/jsonwebtoken' || req.path.substr(0, 5) == '/api/') {
    next();
  } else {
    csrf(req, res, next);
  }
};
app.use(formCSRF);

function oauthAlterResponse(oauth, response, cb) {
  if (response.access_token) {
    var d = Math.round(new Date().getTime()/1000),
      jwt = require('jwt-simple'),
      crypto = require('crypto'),
      base64url = require('base64url'),
      id_token = {
        iss: process.env.ROOT_URL || (oauth.req.protocol + '://' + oauth.req.headers.host),
        sub: oauth.user.id,
        aud: oauth.req.body.client_id,
        exp: d + oauthTokenExpires,
        iat: d,
        nonce: oauth.nonce || ''
      };
    response.id_token = id_token;
    var hbuf = crypto.createHmac('sha256', oauth.client.clientSecret).update(oauth.accessToken).digest();
    response.id_token.ht_hash = base64url(hbuf.toString('ascii', 0, hbuf.length/2));
    response.id_token = jwt.encode(response.id_token, oauth.client.clientSecret);
  }
  cb(response);
}

app.oauth = oauthserver({
  model: models.oauth,
  grants: ['password', 'authorization_code', 'refresh_token'],
  debug: true,
  alterResponse: oauthAlterResponse,
  accessTokenLifetime: oauthTokenExpires
});

app.use(serveStatic(path.join(__dirname, 'public')));

app.get('/', routes.index);

app.all('/oauth/access_token', app.oauth.grant(), app.oauth.errorHandler());

app.get('/oauth/authorize', function(req, res, next) {
  // If a nonce value is provided, add it to the session to support either
  // authorization route as well as the redirect through login.
  if (req.query.nonce && req.query.nonce.length) {
    req.session.nonce = req.query.nonce;
  }

  // If the user is not authenticated, redirect to the login page and preserve
  // all relevant query parameters.
  if (!req.session.userId) {
    log.info({'type': 'authorize', 'message': 'Get request to /oauth/authorize without session. Redirecting to the login page.'});
    return res.redirect('/?redirect=' + req.path + '&client_id=' + req.query.client_id + '&redirect_uri=' + req.query.redirect_uri + '&response_type=' + req.query.response_type + '&state=' + req.query.state + '&scope=' + req.query.scope + '#login');
  }

  // If the user is authenticated, then check whether the user has confirmed
  // authorization for this client/scope combination.
  User.findOne({email: req.session.userId}, function (err, doc) {
    var clientId = req.query.client_id,
      scope = req.query.scope;

    if (err) {
      log.warn({'type': 'authorize:error', 'message': 'An error occurred in /oauth/authorize while trying to fetch the user record for ' + req.session.userId + ' who is an active session.'});
      return next(new errors.BadRequest('An error occurred while processing request. Please try logging in again.'));
    }
    else if (doc && doc.authorized_services && doc.authorized_services.hasOwnProperty(clientId) && doc.authorized_services[clientId].indexOf(scope) !== -1) {
      // The user has confirmed authorization for this client/scope.
      // Proceed with issuing an auth code (see POST /oauth/authorize).
      return app.oauth.authCodeGrant(function (_req, verify) {
        log.info({'type': 'authorize:success', 'message': 'User ' + _req.session.userId + ' has already authorized access to client ' + clientId + '. Continuing auth process.'});
        verify(null, true, _req.session.userId);
      })(req, res, next);
    }
    else {
      Client.findOne({clientId: clientId}, function (err, doc) {
        if (err || !doc || !doc.clientId) {
          log.warn({'type': 'authorize:error', 'message': 'Authorization requested for client with ID ' + clientId + ' which cannot be found.'});
          return next(new errors.BadRequest('An error occurred while processing the request. Please try logging in again.'));
        }

        // The user has not confirmed authorization, so present the
        // authorization page.
        return res.render('authorize', {
          client_id: req.query.client_id,
          client_name: doc.clientName,
          redirect_uri: req.query.redirect_uri,
          response_type: req.query.response_type || 'code',
          scope: req.query.scope || '',
          csrf: req.csrfToken()
        });
      });
    }
  });
}, app.oauth.errorHandler());

app.post('/oauth/authorize', function(req, res, next) {
  // If the user is not authenticated, redirect to the login page.
  if (!req.session.userId) {
    log.info({type: 'authorize', 'message': 'Posting to /oauth/authorize without session. Redirecting to the login page.'});
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

      if (err) {
        log.warn({'type': 'authorize:error', 'message': 'Error occurred while trying to fetch user record for user with email ' + req.session.userId + ' after a successful authorization.'});
        return next(err, false);
      }
      else if (!doc || !doc.user_id) {
        log.warn({'type': 'authorize:error', 'message': 'Could not find a user record for user with email ' + req.session.userId + ' after a successful authorization.'});
        return next(null, false);
      }

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
        log.info({'type': 'authorize:success', 'message': 'User ' + req.session.userId + ' authorized access to client ' + clientId + '.'});
      }
      next(null, true, req.session.userId);
    });
  }
  else {
    // If the user did not confirm authorization for the client/scope, then
    // cancel the authorization process.
    log.info({'type': 'authorize:declined', 'message': 'User ' + req.session.userId + ' declined to authorize access to client ' + clientId + '.'});
    next(null, false, req.session.userId);
  }
}), app.oauth.errorHandler());

app.all('/account', middleware.requiresWebOrApiUser, routes.users.account);
app.get('/account.json', cors(), middleware.requiresWebOrApiUser, routes.users.showjson);

app.post('/jsonwebtoken', routes.users.loginJwt);

app.post('/register', routes.register.form);
app.post('/login', routes.session.create);
app.post('/resetpw', routes.users.resetpw);
app.get('/resetpw/:key', routes.users.resetpwuse);
app.get('/register/:key', routes.users.resetpwuse);

app.get('/admin', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.admin);
app.get('/api/users', middleware.requiresKeySecret, routes.api.getUsers);

app.use(paginate.middleware(10, 50));
app.get('/admin/users', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminUsers.list);
app.get('/admin/users/:id', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminUsers.view);
app.get('/admin/users/:id/ops/:action', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminUsers.action);
app.post('/admin/users/:id/ops/:action', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminUsers.action);

app.get('/admin/apps', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminApps.list);
app.get('/admin/apps/create', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminApps.create);
app.post('/admin/apps/create', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminApps.create);
app.get('/admin/apps/:id', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminApps.view);
app.get('/admin/apps/:id/ops/:action', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminApps.action);
app.post('/admin/apps/:id/ops/:action', middleware.requiresWebUser, middleware.requiresAdminAccess, routes.adminApps.action);

app.all('/logout', function (req, res) {
  log.info({'type': 'logout', 'message': 'Clearing session to log out user ' + req.session.userId});
  req.session.destroy(function () {
    req.session = null;
//TODO: add validation for redirect based on client ID
    var redirect = (req.query.redirect && String(req.query.redirect).length) ? req.query.redirect : '/';
    res.redirect(redirect);
  });
});

app.post('/api/register', middleware.requiresKeySecret, routes.api.register);
app.post('/api/resetpw', middleware.requiresKeySecret, routes.api.resetpw);
app.post('/api/users', middleware.requiresKeySecret, routes.api.users);

app.use(function(err, req, res, next) {
  log.warn({'type': 'error', 'message': 'Error: ' + JSON.stringify(err)});

  if (err && err.code === 'EBADCSRFTOKEN') {
    res.status(403);
    res.render('csrf');
  }
  else {
    res.status(err.code || 500);
    var message = err.message || "The application has encountered an error. Please try again.";
    res.render('error', {
      message: message
    });
  }
});

module.exports = app;
