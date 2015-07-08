var User = require('./../models').User;
var errors = require('./../errors');
var mail = require('./../mail');
var log = require('./../log');
var config = require('./../config');
var async = require('async');
var bcrypt = require('bcrypt');
var Client = require('./../models').OAuthClientsModel;

var userOperations = function(item) {
  ops = {};
  ops["/admin/users/" + item.email] = "View Account";
  if (item.roles === undefined || item.roles.indexOf('admin') == -1) {
    ops["/admin/users/" + item.email + "/promote"] = "Promote to Admin";
  }
  else {
    ops["/admin/users/" + item.email + "/demote"] = "Demote from Admin";
  }

  return ops;
}

module.exports.index = function(req, res) {
  async.series([
    function (cb) {
      // Load user based on user_id.
      // This will get information on our current user to check administrative credential.
      User.findOne({email: req.session.userId}, function(err, user) {
        log.info({type: 'dev', message: user, err: err});

        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        currentUser = user;
        return cb();
      });
    },
  ],
  function (err, results) {
    res.render('adminIndex', {
      user: currentUser,
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
  });
};

module.exports.userList = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.query.dest || '/admin',
    submitted = false,
    message = null,
    currentUser = {},
    data = [];

  async.series([
    function (cb) {
      // Load user based on user_id.
      // This will get information on our current user to check administrative credential.
      User.findOne({email: req.session.userId}, function(err, user) {
        log.info({type: 'dev', message: user, err: err});

        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        currentUser = user;
        return cb();
      });
    },
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
    if (submitted && redirect_uri && redirect_uri != undefined && String(redirect_uri).length) {
      return res.redirect(redirect_uri);
    }

    res.render('adminUserList', {user: currentUser, accounts: data, message: message, redirect_uri: redirect_uri });
  });
};

module.exports.userView = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.query.dest || '/admin/users',
    submitted = false,
    message = null,
    currentUser = {},
    data = [];

  async.series([
    function (cb) {
      // Load user based on user_id.
      // This will get information on our current user to check administrative credential.
      User.findOne({email: req.session.userId}, function(err, user) {
        log.info({type: 'dev', message: user, err: err});

        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        currentUser = user;
        return cb();
      });
    },
    function (cb) {
      // Load user based on user_id.
      User.findOne({email: req.params.id}, function(err, user) {
        log.info({type: 'dev', message: user, err: err});

        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        user.ops = userOperations(user);
        user.roles = [];
        data.push(user);
        return cb();
      });
    },
  ],
  function (err, results) {
    if (submitted && redirect_uri && redirect_uri != undefined && String(redirect_uri).length) {
      return res.redirect(redirect_uri);
    }

    res.render('adminUserView', {user: currentUser, account: data[0], message: message, redirect_uri: redirect_uri });
  });
};

module.exports.userPromote = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.query.dest || '/admin/users',
    submitted = false,
    message = null,
    currentUser = {},
    data = [];

  async.series([
    function (cb) {
      // Load user based on user_id.
      // This will get information on our current user to check administrative credential.
      User.findOne({email: req.session.userId}, function(err, user) {
        log.info({type: 'dev', message: user, err: err});

        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        currentUser = user;
        return cb();
      });
    },
    function (cb) {
      // Load user based on user_id.
      User.findOne({email: req.params.id}, function(err, user) {
        log.info({type: 'dev', message: user, err: err});

        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        user.ops = userOperations(user);
        user.roles = [];
        data.push(user);
        return cb();
      });
    },
  ],
  function (err, results) {
    if (submitted && redirect_uri && redirect_uri != undefined && String(redirect_uri).length) {
      return res.redirect(redirect_uri);
    }

    res.render('confirmForm', {
      user: currentUser,
      action: {
        id: 'promote',
        shortName: 'Promotion',
        label: 'Promote User to Admin',
        target: data[0].email,
        description: "Promote this user to admin, with the ability to manage all users and applications."
      },
      account: data[0],
      message: message,
      redirect_uri: redirect_uri
    });
  });
};

module.exports.appList = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.query.dest || '/admin',
    submitted = false,
    message = null,
    currentUser = {},
    data = [];

  async.series([
    function (cb) {
      // Load user based on user_id.
      // This will get information on our current user to check administrative credential.
      User.findOne({email: req.session.userId}, function(err, user) {
        log.info({type: 'dev', message: user, err: err});

        if (err || !user) {
          message = "Could not load user account. Please try again or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but an error occurred or none was found.', 'err': err, 'user': user});
          return cb(true);
        }
        else if (!user.active) {
          message = "This account has not been verified. Please check your email or contact an administrator.";
          log.warn({'type': 'account:error', 'message': 'Tried to load user account for editing with session ID ' + req.session.userId + ' but the user is not active.', 'user': user});
          return cb(true);
        }

        currentUser = user;
        return cb();
      });
    },
    function (cb) {
      data.push({ clientName: "YourApp", clientId: "your-app-1", clientSecret: '1234512345', redirectUri: 'http://example.com/redirect', loginUri: 'http://example.com/login', description: "YourApp is the example application from the SSO documentation." });
      data.push({ clientName: "MySite", clientId: "my-site-dev", clientSecret: 'abcdeabcde', redirectUri: 'http://example.net/redirect', loginUri: 'http://example.net/login', description: "MySite is an alternate example client." });
      data.push({ clientName: "AllWeb", clientId: "all-web-prod", clientSecret: 'a1b2c3', redirectUri: 'allweb://redirect', loginUri: 'allweb://login', description: "MySite is an alternate example client." });
      return cb();
    }
  ],
  function (err, results) {
    if (submitted && redirect_uri && redirect_uri != undefined && String(redirect_uri).length) {
      return res.redirect(redirect_uri);
    }

    res.render('adminAppList', {user: currentUser, apps: data, message: message, redirect_uri: redirect_uri });
  });
};
