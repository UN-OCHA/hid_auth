var User = require('./../models').User;
var Flood = require('./../models').FloodEntry;
var log = require('./../log');
var async = require('async');

// Number of authentication attempts before the account will be locked against login attempts.
var FLOOD_ATTEMPT_LIMIT_BEFORE_LOCK = 5;
// Length of time before an authentication attempt record is dropped from consideration against the limit.
var FLOOD_ATTEMPT_EXPIRATION_MINUTES = 60;
// Length of time before the login lock is dropped from the flood tracker.
var FLOOD_LOCK_EXPIRATION_MINUTES = 3;


function floodWarning(count) {
  var remaining = FLOOD_ATTEMPT_LIMIT_BEFORE_LOCK - count;
  if (remaining == 1) {
    return 'For security purposes, you have 1 attempt remaining until your account locks down for ' + FLOOD_LOCK_EXPIRATION_MINUTES + ' minutes';
  }
  return 'For security purposes, you have ' + remaining + ' attempts remaining until your account locks down for ' + FLOOD_LOCK_EXPIRATION_MINUTES + ' minutes';
}

function lockAlert(email, user, lockFailure, req) {
  var config = require('./../config');
  var alert = require('./../lib/alert');

  var options = {
    user: user,
    lockoutTime: FLOOD_LOCK_EXPIRATION_MINUTES,
    forgotpassUrl: config.rootURL + '#forgotPass',
    email: email,
    date: new Date(),
    ip: req.get('X-Forwarded-For') || req.ip,
    userAgent: req.get('User-Agent'),
    accountUrl: user && user.user_id ? config.rootURL + '/admin/users/' + user.user_id : '',
    kibanaUrl: 'http://568elmp01.blackmesh.com/kibana/#/dashboard/elasticsearch/HID%20Prod%20Authentication%20Events',
    lockFailure: lockFailure
  };

  alert.admin(options, 'Humanitarian ID: Account Locked for ' + email, req);
  if (user) {
    alert.user(options, 'Humanitarian ID: Account Temporarily Locked', user, req);
  }
}

function clearAuthAttempts(email, cb) {
  Flood.remove({type: 'authenticate', target_id: email}, function(err, item) {
    if (err || !item) {
      log.warn({type: 'flood:error', target_id: email, err: err}, 'Could not remove flood entries.');
    }
    return cb(err);
  });
}

module.exports.create = function(req, res) {
  var floodCount = 1,
    message = '',
    locked = false,
    currentUser = false;

  async.series([
    // If a login lock entry is found, block further authentication attempts.
    function (cb) {
      Flood.hasEntry({type: 'login-lock', target_id: req.body.email}, function(err, found) {
        if (found) {
          locked = found;
          message = '<p>For security purposes, your account has been locked for several minutes. We have sent you an email with additional information.</p>';
          return cb(true);
        }
        return cb();
      });
    },
    // Check authentication. If it fails, create a flood record. If it succeeds,
    // set the currentUser variable.
    function (cb) {
      User.authenticate(req.body.email, req.body.password, function(err, user) {
        if (err || !user) {
          message = '<p>Authentication failed. Do you need to confirm your account or <a class="forgot-password" href="#forgotPass">reset your password?</a></p>';
          log.info({'type': 'authenticate:error', user: req.body.email}, 'Authentication failed for ' + req.body.email + '.');
          Flood.create({ type: 'authenticate', target_id: req.body.email }, FLOOD_ATTEMPT_EXPIRATION_MINUTES, function(err, entry) {
            if (err || !entry) {
              log.warn({type: 'authenticate:warning', parameters: req.body}, 'Could not create flood entry for failed login attempt.');
            }
            return cb();
          });
          return;
        }

        currentUser = user;
        return cb();
      });
    },
    // If the currentUser isn't set, login failed, and the failed auth count
    // should be checked and a login lock created if too many attempts are made.
    function (cb) {
      if (!currentUser) {
        Flood.count({type: 'authenticate', target_id: req.body.email}, function(err, count) {
          if (!err && count) {
            floodCount = count;
            if (floodCount >= FLOOD_ATTEMPT_LIMIT_BEFORE_LOCK) {
              message = '<p>Your account has been locked for ' + FLOOD_LOCK_EXPIRATION_MINUTES + ' minutes. We have sent you an email with additional information.</p>';

              Flood.create({type: 'login-lock', target_id: req.body.email}, FLOOD_LOCK_EXPIRATION_MINUTES, function(err, item) {
                var failure = false;
                if (err || !item) {
                  log.warn({'type': 'flood:error', 'message': 'Error locking login for user with email ' + req.body.email + '.', email: req.body.email, 'err': err});
                  failure = true
                }
                require('./../models').User.findOne({email: req.body.email}, function(err, user) {
                  log.warn({ type: 'authenticate:error', email: req.body.email, 'user': user },
                    'Authentication attempts reached flood limit for this email address.');
                  lockAlert(req.body.email, user, failure, req);
                  clearAuthAttempts(req.body.email, function (err) {
                    return cb(true);
                  });
                });
              });
              return;
            }
          }
          return cb(true);
        });
      }
      else {
        return cb();
      }
    },
    function (cb) {
      // At this point, authentication has succeeded, so wipe any flood entries
      // for failed authentication attempts.
      if (currentUser) {
        clearAuthAttempts(req.body.email, function () {});
      }
      return cb();
    }
  ], function(err, results) {
    if (err) {
      if (floodCount < FLOOD_ATTEMPT_LIMIT_BEFORE_LOCK && !locked) {
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
      redirect += "?client_id=" + req.body.client_id || config.defaultClient;
      redirect += "&redirect_uri=" + req.body.redirect_uri || config.defaultRedirect;
      redirect += "&response_type=" + req.body.response_type || 'token';
      redirect += "&state=" + req.body.state;
      redirect += "&scope=" + req.body.scope || 'profile';

      if (!req.body.response_type || !req.body.scope) {
        log.warn({type: 'authenticate:error', body: req.body, cookies: req.cookies, header: req.headers, query: req.query},
          'Undefined response_type or scope');
      }

      // Record the successful authentication date.
      // This facilitates troubleshooting, e.g., 10 account floods, no successes since last year.
      currentUser.login_last = Date.now();
      currentUser.save(function(err, item) {
        if (err || !item) {
          log.warn({ type: 'account:error', data: item, err: err },
            'Error occurred trying to update user account ' + item.user_id + ' with login success timestamp.'
          );
        }
        else {
          log.info({ type: 'account:success', data: item },
            'User account updated with login access timestamp for ID ' + item.user_id + '.'
          );
        }
      });

      res.redirect(redirect);
      log.info({ type: 'authenticate:success', user: currentUser, 'redirect': redirect },
        'Authentication successful for ' + req.body.email + '. Redirecting to ' + redirect
      );
    }
  });
};
