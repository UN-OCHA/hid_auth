var User = require('./../models').User;
var errors = require('./../errors');
var mail = require('./../mail');
var log = require('./../log');
var config = require('./../config');
var async = require('async');
var bcrypt = require('bcrypt');
var Client = require('./../models').OAuthClientsModel;

function userOperations(item) {
  ops = {};
  ops["/admin/users/" + item.email] = "View Account";
  if (item.roles === undefined || !hasAdminAccess(item)) {
    ops["/admin/users/" + item.email + "/promote"] = "Promote to Admin";
  }
  else {
    ops["/admin/users/" + item.email + "/demote"] = "Demote from Admin";
  }
  if (item.active) {
    ops["/admin/users/" + item.email + "/disable"] = "Disable Account";
  }
  else {
    ops["/admin/users/" + item.email + "/enable"] = "Enable Account";
  }

  ops["/admin/users/" + item.email + "/delete"] = "Delete Account";

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
  res.render('adminIndex', {
    user: req.user,
    pages: [
      {
        label: 'Administrate Users',
        path: 'admin/users',
        description: 'Administer user accounts, including promotion to or demotion from administrative status.'
      },
      {
        label: 'Administrate Apps',
        path: 'admin/app',
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
            item.ops = userOperations(item);
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
    data = [];

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

        user.ops = userOperations(user);
        user.roles = user.roles || [];
        data.push(user);
        return cb();
      });
    }
  ],
  function (err, results) {
    res.render('adminUserView', {
      user: req.user,
      account: data[0],
      message: message,
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri
    });
  });
};

module.exports.userPromote = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    submitted = false,
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

        user.ops = userOperations(user);
        user.roles = user.roles || [];
        data = user;
        return cb();
      });
    },
    function (cb) {
      // If the user already has the admin role something has changed.
      if (hasAdminAccess(data)) {
        message = "The target user account is already an administrator.";
        log.debug({type: 'account:status', message: 'The account for user ' + data.email + ' is already an administrator.'});
        return cb(true);
      }

      // If the CSRF token was not posted, this was not a form submit.
      // Bail as error to skip further processing.
      if (options._csrf == undefined) {
        log.debug({type: 'confirmForm:status', message: 'The account for user ' + data.email + ' is already an administrator.'});
        return cb(true);
      }

      return cb();
    },
    function (cb) {
      // Process/save the submitted form values.
      submitted = true;
      data = addRole(data, 'admin');

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
  ],
  function (err, results) {
    next = {};
    next["/admin/users"] = "View Users";
    next["/admin/users/" + data.email] = "View " + data.email;

    res.render('confirmForm', {
      user: req.user,
      action: {
        id: 'promote',
        shortName: 'Promotion',
        label: 'Promote User to Admin',
        target: data.email,
        description: "Promote this user to admin, with the ability to manage all users and applications."
      },
      account: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted || (err && hasAdminAccess(data)),
      next: next
    });
  });
};

module.exports.userDemote = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    submitted = false,
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

        user.ops = userOperations(user);
        user.roles = user.roles || [];
        data = user;
        return cb();
      });
    },
    function (cb) {
      // If the user already has the admin role something has changed.
      if (!hasAdminAccess(data)) {
        message = "The target user account is not an administrator.";
        return cb(true);
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
      data = removeRole(data, 'admin');

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
  ],
  function (err, results) {
    next = {};
    next["/admin/users"] = "View Users";
    next["/admin/users/" + data.email] = "View " + data.email;

    res.render('confirmForm', {
      user: req.user,
      action: {
        id: 'demote',
        shortName: 'Demotion',
        label: 'Demote User from Admin',
        target: data.email,
        description: "Demote this user from administrative powers."
      },
      account: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted || (err && !hasAdminAccess(data)),
      next: next
    });
  });
};

module.exports.userDisable = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    submitted = false,
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

        user.ops = userOperations(user);
        user.roles = user.roles || [];
        data = user;
        return cb();
      });
    },
    function (cb) {
      // If the user already has the admin role something has changed.
      if (!data.active) {
        message = "The target user account is already disabled.";
        return cb(true);
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
      data.active = 0;

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
  ],
  function (err, results) {
    next = {};
    next["/admin/users"] = "View Users";
    next["/admin/users/" + data.email] = "View " + data.email;

    res.render('confirmForm', {
      user: req.user,
      action: {
        id: 'disable',
        shortName: 'Deactivation',
        label: 'Disable Account',
        target: data.email,
        description: "Disable this user."
      },
      account: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted || (err && !data.active),
      next: next
    });
  });
};

module.exports.userEnable = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    submitted = false,
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

        user.ops = userOperations(user);
        user.roles = user.roles || [];
        data = user;
        return cb();
      });
    },
    function (cb) {
      if (data.active) {
        message = "The target user account is already enabled.";
        return cb(true);
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
      data.active = 1;

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
  ],
  function (err, results) {
    next = {};
    next["/admin/users"] = "View Users";
    next["/admin/users/" + data.email] = "View " + data.email;

    res.render('confirmForm', {
      user: req.user,
      action: {
        id: 'enable',
        shortName: 'Activation',
        label: 'Enable Account',
        target: data.email,
        description: "Enable this user account. They will be able to authenticate with H.ID."
      },
      account: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted || (err && data.active),
      next: next
    });
  });
};

module.exports.userDelete = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/users',
    submitted = false,
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

        user.ops = userOperations(user);
        user.roles = user.roles || [];
        data = user;
        return cb();
      });
    },
    function (cb) {
      if (data.active) {
        message = "You may not delete an account until first disabling it.";
        return cb(true);
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
  ],
  function (err, results) {
    res.render('confirmForm', {
      user: req.user,
      action: {
        id: 'delete',
        shortName: 'Deletion',
        label: 'Delete Account',
        target: data.email,
        description: "Delete this account. It cannot be restored!"
      },
      account: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted || (err && data.active),
      next: {
        "/admin/users": "View Users"
      }
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
