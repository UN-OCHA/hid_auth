var User = require('./../models').User;
var errors = require('./../errors');
var mail = require('./../mail');
var log = require('./../log');
var config = require('./../config');
var async = require('async');
var bcrypt = require('bcrypt');
var Client = require('./../models').OAuthClientsModel;

function userOperations(account, modal) {
  ops = {};
  var sep = modal ? '#' : '/ops/';

  ops.view = {
    id: 'view',
    shortName: 'View',
    label: "View Account",
    target: account.email,
    description: 'View the details for the user account.',
    uri: "/admin/users/" + account.email,
    valid: !modal
  };
  ops.promote = {
    id: 'promote',
    shortName: 'Promotion',
    label: 'Promote to Admin',
    target: account.email,
    description: "Promote this user to admin, with the ability to manage all users and applications.",
    uri: "/admin/users/" + account.email + sep + "promote",
    submitUri: "/admin/users/" + account.email + "/ops/promote",
    valid: account.roles === undefined || !hasAdminAccess(account)
  };
  ops.demote = {
    id: 'demote',
    shortName: 'Demotion',
    label: 'Demote from Admin',
    target: account.email,
    description: "Demote this user from administrative powers.",
    uri: "/admin/users/" + account.email + sep + "demote",
    submitUri: "/admin/users/" + account.email + "/ops/demote",
    valid: account.roles !== undefined && hasAdminAccess(account)
  };
  ops.disable = {
    id: 'disable',
    shortName: 'Deactivation',
    label: 'Disable Account',
    target: account.email,
    description: "Disable this user.",
    uri: "/admin/users/" + account.email + sep + "disable",
    submitUri: "/admin/users/" + account.email + "/ops/disable",
    valid: account.active
  };
  ops.enable = {
    id: 'enable',
    shortName: 'Activation',
    label: 'Enable Account',
    target: account.email,
    description: "Enable this user account. They will be able to authenticate with H.ID.",
    uri: "/admin/users/" + account.email + sep + "enable",
    submitUri: "/admin/users/" + account.email + "/ops/enable",
    valid: !account.active
  };
  ops.delete = {
    id: 'delete',
    shortName: 'Deletion',
    label: 'Delete Account',
    target: account.email,
    description: "Delete this account. It cannot be restored!",
    uri: "/admin/users/" + account.email + sep + "delete",
    submitUri: "/admin/users/" + account.email + "/ops/delete",
    valid: !account.active
  };

  return ops;
}

function hasAdminAccess(account) {
  return account.roles.indexOf('admin') > -1;
}

function addRole(account, role) {
  // @todo ensure only one instance of the role is added.
  account.roles.push(role);

  return account;
}

function removeRole(account, role) {
  account.roles.splice(account.roles.indexOf(role), 1);

  return account;
}

module.exports.index = function(req, res) {
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

module.exports.userList = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin',
    message = null,
    currentUser = {},
    data = [];

  async.series([
    function (cb) {
      User.find({}, function(err, users) {
        if (err) {
          message = "Could not load users. Please try again."
          log.warn({type: 'admin:userlist:error', message: 'Failed to load list of users.'});
        }
        else {
          data = users.map(function(item) {
            item.ops = userOperations(item, false);
            item.roles = item.roles || [];
            item.authorized_services = item.authorized_services || {};
            return item;
          });
        }
        return cb();
      })
    }
  ],
  function (err, results) {
    res.render('adminUserList', {
      user: req.user,
      accounts: data,
      message: message,
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri
    });
  });
};

module.exports.userView = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    message = null,
    currentUser = {},
    data = {};

  async.series([
    function (cb) {
      // Load user based on user_id.
      User.findOne({email: req.params.id}, function(err, user) {
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
    }
  ],
  function (err, results) {
    res.render('adminUserView', {
      user: req.user,
      account: data,
      actions: userOperations(data, true),
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

module.exports.userAction = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    next = { "/admin/users": "View Users" },
    submitted = false,
    invalid = false,
    message = null,
    currentUser = {},
    data = {};

  async.series([
    function (cb) {
      // Load user based on user_id.
      User.findOne({email: req.params.id}, function(err, user) {
        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with parameter ' + req.params.id + ' but an error occurred or none was found.', 'err': err, 'user': user});
          res.redirect(cancel_uri);
          return cb(true);
        }

        user.ops = userOperations(user, false);
        user.roles = user.roles || [];
        data = user;

        if (req.params.action != 'delete') {
          next["/admin/users/" + data.email] = "View " + data.email;
        }

        return cb();
      });
    },
    function (cb) {
      switch(req.params.action) {
        case 'promote':
          // If the user already has the admin role something has changed.
          if (!data.ops.promote.valid) {
            message = "The target user account is already an administrator.";
            log.debug({type: 'account:status', message: 'The account for user ' + data.email + ' is already an administrator.'});
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

      if (req.params.action != 'delete') {
        return data.save(function (err, item) {
          if (err || !item) {
            message = "Error updating the user account.";
            log.warn({'type': 'account:error', 'message': 'Error occurred trying to update user account for email address ' + data.email + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data = item;
            message = "Settings successfully saved.";
            log.info({'type': 'account:success', 'message': 'User account updated for email address ' + data.email + '.', 'data': data});
            return cb();
          }
        });
      }
      else {
        return data.remove(function(err, item) {
          if (err || !item) {
            message = "Error updating the user account.";
            log.warn({'type': 'account:error', 'message': 'Error occurred trying to delete user account for email address ' + data.email + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data = item;
            message = "Settings successfully saved.";
            log.info({'type': 'account:success', 'message': 'User account deleted for email address ' + data.email + '.', 'data': data});
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

module.exports.appList = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin',
    message = null,
    currentUser = {},
    data = [];

  async.series([
    function (cb) {
      data.push({ clientName: "YourApp", clientId: "your-app-1", clientSecret: '1234512345', redirectUri: 'http://example.com/redirect', loginUri: 'http://example.com/login', description: "YourApp is the example application from the SSO documentation." });
      data.push({ clientName: "MySite", clientId: "my-site-dev", clientSecret: 'abcdeabcde', redirectUri: 'http://example.net/redirect', loginUri: 'http://example.net/login', description: "MySite is an alternate example client." });
      data.push({ clientName: "AllWeb", clientId: "all-web-prod", clientSecret: 'a1b2c3', redirectUri: 'allweb://redirect', loginUri: 'allweb://login', description: "MySite is an alternate example client." });
      return cb();
    }
  ],
  function (err, results) {
    res.render('adminAppList', {
      user: req.user,
      apps: data,
      message: message,
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri
    });
  });
};
