var User = require('./../models').User;
var Flood = require('./../models').FloodEntry;
var log = require('./../log');
var async = require('async');


function floodWarning(count) {
  var remaining = 5 - count;
  if (remaining == 1) {
    return 'You have 1 more login attempt before your account will be temporarily locked.';
  }
  return 'You have ' + remaining + ' remaining login attempts before your account will be temporarily locked.';
}

module.exports.create = function(req, res) {
  var floodCount = 0,
    message = '',
    currentUser = {};

  async.series([
    function (cb) {
      log.info({type: 'dev', message: 'flood event count'});
      Flood.count({ type: 'authenticate', target_id: req.body.email }, function(err, count) {
        if (!err && count) {
          // If count matters, the current request is also a failed login attempt.
          floodCount = count + 1;
        }
        return cb();
      });
    },
    function (cb) {
      log.info({type: 'dev', message: 'flood event lock'});
      if (floodCount >= 5) {
        message = '<p>You have reached the maximum number of login attempts at this time.</p>';
        log.warn({
          type: 'authenticate:error',
          message: 'Authentication attempts reached flood limit for this email address.',
          email: req.body.email
        });

        // @todo look up email address to include last login/not-a-user info in the log.
        return cb(true);
      }

      return cb();
    },
    function (cb) {
      User.authenticate(req.body.email, req.body.password, function(err, user) {
        if (err || !user) {
          message = '<p>Authentication failed. Do you need to confirm your account or <a class="forgot-password" href="#forgotPass">reset your password?</a></p>';
          log.info({'type': 'authenticate:error', 'message': 'Authentication failed for ' + req.body.email + '.', user: req.body.email});
          Flood.create({ type: 'authenticate', target_id: req.body.email }, 60, function(err, entry) {
            if (err || !entry) {
              log.warn({type: 'authenticate:warning', message: 'Could not create flood entry for failed login attempt.', parameters: req.body});
            }
          });
          return cb(true);
        }

        currentUser = user;
        return cb();
      });
    }

  ], function(err, results) {
    if (err) {
      if (floodCount < 5) {
        message += '<p>' + floodWarning(floodCount) + '</p>';
      }
      res.status(401).render('index', {
        message: message,
        client_id: req.body.client_id || '',
        redirect: req.body.redirect || '',
        redirect_uri: req.body.redirect_uri || '',
        response_type: req.body.response_type || '',
        state: req.body.state || '',
        scope: req.body.scope || '',
        csrf: req.csrfToken()
      });
    }
    else {
      req.session.userId = currentUser.email;
      var redirect = req.body.redirect || '/account';
      redirect += "?client_id=" + req.body.client_id;
      redirect += "&redirect_uri=" + req.body.redirect_uri;
      redirect += "&response_type=" + req.body.response_type;
      redirect += "&state=" + req.body.state;
      redirect += "&scope=" + req.body.scope;

      // Record the successful authentication date.
      // This facilitates troubleshooting, e.g., 10 account floods, no successes since last year.
      currentUser.login_last = Date.now();
      currentUser.save(function(err, item) {
        if (err || !item) {
          log.warn({
            type: 'account:error',
            message: 'Error occurred trying to update user account ' + item.user_id + ' with login success timestamp.',
            data: item,
            err: err
          });
        }
        else {
          log.info({
            type: 'account:success',
            message: 'User account updated with login access timestamp for ID ' + item.user_id + '.',
            data: item
          });
        }
      });

      res.redirect(redirect);
      log.info({
        type: 'authenticate:success',
        message: 'Authentication successful for ' + req.body.email + '. Redirecting to ' + redirect,
        user: currentUser
      });
    }
  });
};
