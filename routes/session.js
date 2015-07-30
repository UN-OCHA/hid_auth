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

function lockAlert(email, user, lockFailure, req) {
  var message = 'Hello HID Administrators,\n\nThis is an alert to inform you that the email "'
    + email + '" has been locked for multiple failed login attempts. It should unlock automatically'
    + ' in the next few minutes.\n\nDate: ' + new Date() + '\n\t* IP:' + req.ip
    + '\n\t* User Agent: ' + req.get('User-Agent');

  if (!user) {
    message += '\n\nPLEASE NOTE\n\nThis email address is not the primary email of any HID account.';
  }
  else {
    message += '\n\nThis email address is associated with a user acount:'
      + '\n\t* User ID: ' + user.user_id
      + '\n\tName: ' + user.name_given + ' ' + user.name_family
      + '\n\tView Account: ' + require('../config').rootURL + '/admin/users/' + user.user_id;
  }

  message += '\n\nTo view the related logs please visit the Kibana Dashboard for HID Authentication:'
    + '\n\n\thttp://568elmp01.blackmesh.com/kibana/#/dashboard/elasticsearch/HID%20Prod%20Authentication%20Events'

  if (lockFailure) {
    message += '\n\nSPECIAL NOTICE\n\nThe lock was successfully triggered, but something went wrong.'
      + 'The account is not actually locked against further authentication attempts.';
  }

  require('../lib/alert').send(message, 'Account Locked for ' + email, req);
}

module.exports.create = function(req, res) {
  var floodCount = 1,
    message = '',
    locked = false,
    currentUser = {};

  async.series([
    function (cb) {
      Flood.count({ type: 'authenticate', target_id: req.body.email }, function(err, count) {
        if (!err && count) {
          // If count matters, the current request is also a failed login attempt.
          floodCount = count + 1;
        }
        return cb();
      });
    },
    function (cb) {
      if (floodCount >= 5) {
        message = '<p>You have reached the maximum number of login attempts for the next several minutes.</p>';

        // @todo look up email address to include last login/not-a-user info in the log.
        log.warn({ type: 'authenticate:error', email: req.body.email },
          'Authentication attempts reached flood limit for this email address.');

        Flood.create({type: 'login-lock', target_id: req.body.email}, 3, function(err, item) {
          var failure = false;
          if (err || !item) {
            failure = true;
            log.warn({'type': 'flood:error', 'message': 'Error locking login for user with email ' + req.body.email + '.', data: req.body.email, 'err': err});
          }
          require('./../models').User.findOne({email: req.body.email}, function(err, user) {
            lockAlert(req.body.email, user, failure, req);
          })

          // While the current process does not depend on the login-lock flood entry,
          // conceivably the user could resubmit fast enough that if Mongo is backlogged
          // they could slip through.
          return cb(true);
        });
      }

      return cb();
    },
    function (cb) {
      Flood.hasEntry({type: 'login-lock', target_id: req.body.email}, function(err, found) {
        if (found) {
          locked = found;
          // We do not need to wait for authentication entries to be removed.
          message = '<p>You have reached the maximum number of login attempts at this time.</p>';

          Flood.remove({type: 'authenticate', target_id: req.body.email}, function(err, item) {
            if (err || !item) {
              log.warn({type: 'flood:error', target_id: req.body.email, err: err}, 'Could not remove flood entries.');
            }
          });

          return cb(true);
        }
        return cb();
      });
    },
    function (cb) {
      User.authenticate(req.body.email, req.body.password, function(err, user) {
        if (err || !user) {
          message = '<p>Authentication failed. Do you need to confirm your account or <a class="forgot-password" href="#forgotPass">reset your password?</a></p>';
          log.info({'type': 'authenticate:error', user: req.body.email}, 'Authentication failed for ' + req.body.email + '.');
          Flood.create({ type: 'authenticate', target_id: req.body.email }, 60, function(err, entry) {
            if (err || !entry) {
              log.warn({type: 'authenticate:warning', parameters: req.body}, 'Could not create flood entry for failed login attempt.');
            }
          });

          // We do not need to wait for the flood entry to be created before proceeding.
          return cb(true);
        }

        currentUser = user;
        return cb();
      });
    },
    function (cb) {
      // Wipe flood entries for failed authentication attempts if login succeeded.
      Flood.remove({type: 'authenticate', target_id: req.body.email}, function(err, item) {
        if (err || !item) {
          log.warn({type: 'flood:error', target_id: req.body.email, err: err}, 'Could not remove flood entries.');
        }
      });

      return cb();
    }
  ], function(err, results) {
    if (err) {
      if (floodCount < 5 && !locked) {
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
