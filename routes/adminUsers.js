var User = require('./../models').User;
var Flood = require('./../models').FloodEntry;
var errors = require('./../errors');
var log = require('./../log');
var async = require('async');
var paginate = require('express-paginate');

function operations(account, modal, env) {
  ops = {};
  var sep = modal ? '#' : '/ops/';
  var dev = env == 'development' || env == 'dockerdev' || env == 'blackmeshdev';

  ops.view = {
    id: 'view',
    shortName: 'View',
    label: "View Account",
    target: account.user_id,
    description: 'View the details for the user account.',
    uri: "/admin/users/" + account.email,
    valid: !modal
  };
  ops.promote = {
    id: 'promote',
    shortName: 'Promotion',
    label: 'Promote to Admin',
    target: account.user_id,
    description: "Promote this user to admin, with the ability to manage all users and applications.",
    uri: "/admin/users/" + account.user_id + sep + "promote",
    submitUri: "/admin/users/" + account.user_id + "/ops/promote",
    valid: account.roles === undefined || !hasAdminAccess(account)
  };
  ops.demote = {
    id: 'demote',
    shortName: 'Demotion',
    label: 'Demote from Admin',
    target: account.user_id,
    description: "Demote this user from administrative powers.",
    uri: "/admin/users/" + account.user_id + sep + "demote",
    submitUri: "/admin/users/" + account.user_id + "/ops/demote",
    valid: account.roles !== undefined && hasAdminAccess(account)
  };
  ops.disable = {
    id: 'disable',
    shortName: 'Deactivation',
    label: 'Disable Account',
    target: account.user_id,
    description: "Disable this user.",
    uri: "/admin/users/" + account.user_id + sep + "disable",
    submitUri: "/admin/users/" + account.user_id + "/ops/disable",
    valid: account.active
  };
  ops.enable = {
    id: 'enable',
    shortName: 'Activation',
    label: 'Enable Account',
    target: account.user_id,
    description: "Enable this user account. They will be able to authenticate with H.ID.",
    uri: "/admin/users/" + account.user_id + sep + "enable",
    submitUri: "/admin/users/" + account.user_id + "/ops/enable",
    valid: !account.active
  };
  ops.unlock = {
    id: 'unlock',
    shortName: 'Unlock',
    label: 'Unlock Login',
    target: account.user_id,
    description: 'This account has been locked out due to repeated, failed attempts to login.'
    + ' Normally this lock is removed automatically after several minutes, this is a special override.',
    uri: "/admin/users/" + account.user_id + sep + "unlock",
    submitUri: "/admin/users/" + account.user_id + "/ops/unlock",
    valid: account.active && account.locked
  };
  ops.lock = {
    id: 'lock',
    shortName: 'Lock',
    label: 'Lock Login',
    target: account.user_id,
    description: 'Lock the user account to prevent malicious login attempts for 5 hours.',
    uri: "/admin/users/" + account.user_id + sep + "lock",
    submitUri: "/admin/users/" + account.user_id + "/ops/lock",
    valid: account.active && !account.locked
  };
  ops.delete = {
    id: 'delete',
    shortName: 'Deletion',
    label: 'Delete Account',
    target: account.user_id,
    description: "Delete this account. It cannot be restored!",
    uri: "/admin/users/" + account.user_id + sep + "delete",
    submitUri: "/admin/users/" + account.user_id + "/ops/delete",
    valid: !account.active
  };

  return ops;
}

function hasAdminAccess(account) {
  return account.roles.indexOf('admin') > -1;
}

function addRole(account, role) {
  if (account.roles.indexOf(role) == -1) {
    account.roles.push(role);
  }

  return account;
}

function removeRole(account, role) {
  account.roles.splice(account.roles.indexOf(role), 1);

  return account;
}

module.exports.list = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin',
    message = null,
    data = [],
    size = 10,
    start = size * (req.query.page - 1);

  User.list({start: start, limit: size, find: req.query.q},  function(err, count, users) {
    if (err) {
      message = "Could not load users. Please try again."
      log.warn({type: 'admin:userlist:error', message: 'Failed to load list of users.'});
    }
    else {
      data = users.map(function(item) {
        item.ops = operations(item, false, req.app.get('env'));
        item.roles = item.roles || [];
        item.authorized_services = item.authorized_services || {};
        return item;
      });
    }
    console.log(count);
    var pageCount = count / size;
    res.render('adminUserList', {
      user: req.user,
      accounts: data,
      message: message,
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      pageCount: pageCount,
      itemCount: count,
      pages: paginate.getArrayPages(req)(3, pageCount, req.query.page),
      q: req.query.q ? req.query.q : ''
    });
  });
};

module.exports.view = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    message = null,
    data = {};

  async.series([
    function (cb) {
      // Load user based on user_id.
      User.findOne({user_id: req.params.id}, function(err, user) {
        if (err || !user) {
          message = "Could not load requested user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account ' + req.params.id + ' but an error occurred or none was found.', 'err': err, 'user': user});
          res.redirect(cancel_uri);
          return cb(true);
        }

        user.roles = user.roles || [];
        user.authorized_services = user.authorized_services || {};
        data = user;
        return cb();
      });
    },
    function (cb) {
      Flood.hasEntry({type: 'login-lock', target_id: data.email}, function(err, locked) {
        if (!err, locked) {
          data.locked = locked;
        }

        return cb();
      });
    }
  ],
  function (err, results) {
    res.render('adminUserView', {
      user: req.user,
      account: data,
      actions: operations(data, true, req.app.get('env')),
      message: message,
      redirect_uri: redirect_uri,
      csrf: req.csrfToken(),
      cancel_uri: cancel_uri,
      next: {
        "/admin/users": "View Users"
      }
    });
  });
};

module.exports.action = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    next = { "/admin/users": "View Users" },
    submitted = false,
    message = null,
    data = {};

  async.series([
    function (cb) {
      // Load user based on user_id.
      User.findOne({user_id: req.params.id}, function(err, user) {
        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with parameter ' + req.params.id + ' but an error occurred or none was found.', 'err': err, 'user': user});
          res.redirect(cancel_uri);
          return cb(true);
        }

        user.roles = user.roles || [];
        data = user;

        if (req.params.action != 'delete') {
          next["/admin/users/" + data.user_id] = "View " + data.email;
        }

        return cb();
      });
    },
    function (cb) {
      Flood.hasEntry({type: 'login-lock', target_id: data.email}, function(err, locked) {
        if (!err, locked) {
          data.locked = locked;
        }
        data.ops = operations(data, false, req.app.get('env'));

        return cb();
      });
    },
    function (cb) {
      switch(req.params.action) {
        case 'promote':
          // If the user already has the admin role something has changed.
          if (!data.ops.promote.valid) {
            message = "The target user account is already an administrator.";
            log.debug({type: 'account:status', message: 'The account for user ' + data.user_id + ' is already an administrator.'});
            return cb(true);
          }
          else {
            data = addRole(data, 'admin');
          }
          break;
        case 'demote':
          // If the user already has the admin role something has changed.
          if (!data.ops.demote.valid) {
            message = "The target user account is not an administrator.";
            return cb(true);
          }
          else {
            data = removeRole(data, 'admin');
          }
          break;
        case 'enable':
          if (!data.ops.enable.valid) {
            message = "The target user account is already enabled.";
            return cb(true);
          }
          else {
            data.active = 1;
          }
          break;
        case 'disable':
          // If the user already has the admin role something has changed.
          if (!data.ops.disable.valid) {
            message = "The target user account is already disabled.";
            return cb(true);
          }
          else {
            data.active = 0;
          }
          break;
        case 'unlock':
          // If the user already has the admin role something has changed.
          if (!data.ops.unlock.valid) {
            message = "The target user account is inactive or not locked.";
            return cb(true);
          }
          break;
        case 'lock':
          // If the user already has the admin role something has changed.
          if (!data.ops.lock.valid) {
            message = '<p>The target user account must be active & unlocked.</p>'
              + '<p>This operation is only available in development environments.</p>';
            return cb(true);
          }
          break;
        case 'delete':
          if (!data.ops.delete.valid) {
            message = "You may not delete an account until first disabling it.";
            return cb(true);
          }
          break;
      }

      // If the CSRF token was not posted, this was not a form submit.
      // Bail as error to skip further processing.
      if (options._csrf == undefined) {
        return cb(true);
      }

      return cb();
    },
    function (cb) {
      // Process/save the submitted form values.
      submitted = true;

      if (req.params.action == 'unlock') {
        Flood.remove({type: 'login-lock', target_id: data.email}, function(err, items) {
          if (err || !items) {
            message = 'Error unlocking the user account.';
            log.warn({'type': 'flood:error', 'message': 'Error clearing the flood entries locking the user with ID ' + data.user_id + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            delete data.locked;
            message = 'User account successfully unlocked.';
            log.warn({'type': 'flood:success', 'message': 'Cleared the flood entries locking the user with ID ' + data.user_id + '.', data: data, 'err': err});
            return cb();
          }
        });
      }
      else if (req.params.action == 'lock') {
        Flood.create({type: 'login-lock', target_id: data.email}, 300, function(err, item) {
          if (err || !item) {
            message = 'Error locking the user account.';
            log.warn({'type': 'flood:error', 'message': 'Error locking login for user with ID ' + data.user_id + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data.locked = true;
            message = 'User account successfully locked for 5 hours.';
            log.warn({'type': 'flood:success', 'message': 'Created flood entries to lock the user with ID ' + data.user_id + '.', data: data, flood: item, 'err': err});
            return cb();
          }
        });
      }
      else if (req.params.action != 'delete') {
        return data.save(function (err, item) {
          if (err || !item) {
            message = "Error updating the user account.";
            log.warn({'type': 'account:error', 'message': 'Error occurred trying to update user account ' + data.user_id + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data = item;
            message = "Settings successfully saved.";
            log.info({'type': 'account:success', 'message': 'User account updated for ID ' + data.user_id + '.', 'data': data});
            return cb();
          }
        });
      }
      else {
        return data.remove(function(err, item) {
          if (err || !item) {
            message = "Error deleting the user account.";
            log.warn({'type': 'account:error', 'message': 'Error occurred trying to delete user account for ID ' + data.user_id + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data = item;
            message = "User account successfully deleted.";
            log.info({'type': 'account:success', 'message': 'User account deleted for ID ' + data.user_id + '.', 'data': data});
            return cb();
          }
        });
      }
    }
  ],
  function (err, results) {
    res.render('confirmFormPage', {
      user: req.user,
      action: data.ops[req.params.action],
      account: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted || (err && !data.ops[req.params.action].valid),
      next: next
    });
  });
};
