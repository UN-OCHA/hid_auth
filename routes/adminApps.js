var Client = require('./../models').OAuthClientsModel;
var errors = require('./../errors');
var log = require('./../log');
var async = require('async');
var validator = require('validator');

function operations(app, modal) {
  ops = {};
  var sep = modal ? '#' : '/ops/';

  ops.view = {
    id: 'view',
    shortName: 'View',
    label: "View App",
    target: app.clientId,
    description: 'View the details for the application.',
    uri: "/admin/apps/" + app.clientId,
    valid: !modal
  };
  ops.edit = {
    id: 'edit',
    shortName: 'Edit',
    label: 'Edit Settings',
    target: app.clientId,
    description: 'Update settings for this <a href="/admin/apps/' + app.clientId + '">application</a>.',
    uri: "/admin/apps/" + app.clientId + sep + "edit",
    submitUri: "/admin/apps/" + app.clientId + "/ops/edit",
    valid: true
  };
  ops.revoke = {
    id: 'revoke',
    shortName: 'Revoke',
    label: 'Revoke Access',
    target: app.clientId,
    description: "Revoke this applications authorization to connect with Humanitarian ID. It's record will be permanently deleted.",
    uri: "/admin/apps/" + app.clientId + sep + "revoke",
    submitUri: "/admin/apps/" + app.clientId + "/ops/revoke",
    // Specified so the button to delete apps is only presented on the dedicated view page.
    valid: modal
  };

  return ops;
}

function listOperations() {
  return {
    create: {
      id: 'create',
      shortName: 'Create',
      label: 'Create App',
      uri: '/admin/apps#create',
      submitUri: '/admin/apps/create',
      valid: true
    }
  };
}

module.exports.list = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin',
    message = null,
    data = [];

  async.series([
    function (cb) {
      Client.find({}, function(err, apps) {
        if (err) {
          message = "Could not load clients. Please try again."
          log.warn({type: 'admin:clientList:error', message: 'Failed to load list of clients.'});
        }
        else {
          data = apps.map(function(item) {
            item.description = item.description || '';
            item.ops = operations(item, false);
            return item;
          });
        }
        return cb();
      })
    }
  ],
  function (err, results) {
    res.render('adminAppList', {
      user: req.user,
      app: {
        clientId: '',
        clientName: '',
        clientSecret: '',
        redirectUri: '',
        loginUri: '',
        description: ''
      },
      apps: data,
      actions: listOperations(),
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri
    });
  });
};

module.exports.view = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/apps',
    message = null,
    data = {};

  async.series([
    function (cb) {
      // Load client based on client id.
      Client.findOne({clientId: req.params.id}, function(err, client) {
        if (err || !client) {
          message = "Could not load requested client application. Please try again or contact an administrator.";
          log.warn({'type': 'client:error', 'message': 'Tried to load client application ' + req.params.id + ' but an error occurred or none was found.', 'err': err, 'client': client});
          res.redirect(cancel_uri);
          return cb(true);
        }

        client.description = client.description || '';
        client.ops = operations(client, true),
        data = client;
        return cb();
      });
    }
  ],
  function (err, results) {
    res.render('adminAppView', {
      user: req.user,
      app: data,
      actions: data.ops,
      message: message,
      redirect_uri: redirect_uri,
      csrf: req.csrfToken(),
      cancel_uri: cancel_uri,
      next: {
        "/admin/apps": "View Applications"
      }
    });
  });
};


module.exports.action = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/apps',
    next = { "/admin/apps": "View Applications" },
    submitted = false,
    changed = false,
    message = null,
    data = {};

  async.series([
    function (cb) {
      // Load client based on client id.
      Client.findOne({clientId: req.params.id}, function(err, client) {
        if (err || !client) {
          message = "Could not load requested client application. Please try again or contact an administrator.";
          log.warn({'type': 'client:error', 'message': 'Tried to load client application ' + req.params.id + ' but an error occurred or none was found.', 'err': err, 'client': client});
          res.redirect(cancel_uri);
          return cb(true);
        }

        client.description = client.description || '';
        client.ops = operations(client, false);
        data = client;
        return cb();
      });
    },
    function (cb) {
      switch(req.params.action) {
        case 'edit':
          // If the user already has the admin role something has changed.
          if (!data.ops.edit.valid) {
            message = "The application cannot be edited.";
            return cb(true);
          }
          else {
            // Update any fields
            for (var key in options) {
              if (options.hasOwnProperty(key)) {
                data[key] = options[key];
                changed = true;
              }
            }
          }
          break;
        case 'revoke':
          if (!data.ops.revoke.valid) {
            message = "Cannot revoke this client.";
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
    function(cb) {
      if (req.params.action != 'revoke') {
        var opts = {require_tld: false, require_protocol: true};
        if (!validator.isURL(options.redirectUri, opts)) {
          message = "Redirect URI is not valid.";
          return cb(true);
        }
        if (!validator.isURL(options.loginUri, opts)) {
          message = "Login URI is not valid.";
          return cb(true);
        }

        return cb();
      }
    },
    function (cb) {
      // Process/save the submitted form values.
      submitted = true;

log.info({type: 'dev', data:data});
      if (req.params.action != 'revoke') {
        return data.save(function (err, item) {
          if (err || !item) {
            message = "Error updating the client application.";
            log.warn({'type': 'client:error', 'message': 'Error occurred trying to update client for ID ' + data.clientId + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data = item;
            message = "Client settings successfully saved.";
            log.info({'type': 'client:success', 'message': 'Client application updated for ID ' + data.clientId + '.', 'data': data});
            return cb();
          }
        });
      }
      else {
        return data.remove(function(err, item) {
          if (err || !item) {
            message = "Error removing the client.";
            log.warn({'type': 'account:error', 'message': 'Error occurred trying to delete client application for ID ' + data.clientId + '.', 'data': data, 'err': err});
            return cb(true);
          }
          else {
            data = item;
            message = "Client successfully deleted.";
            log.info({'type': 'account:success', 'message': 'Client App deleted for ID ' + data.clientId + '.', 'data': data});
            return cb();
          }
        });
      }
    }
  ],
  function (err, results) {
    var template = req.params.action == 'edit' ? 'appFormPage' : 'confirmFormPage';
    res.render(template, {
      user: req.user,
      action: data.ops[req.params.action],
      app: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted || (err && !data.ops[req.params.action].valid),
      next: next
    });
  });
};

module.exports.create = function(req, res) {
  var options = req.body || {},
    redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin/apps',
    next = { "/admin/apps": "View Applications" },
    submitted = false,
    message = null,
    data = {
      clientId: '',
      clientName: '',
      clientSecret: '',
      redirectUri: '',
      loginUri: '',
      description: ''
    };

  async.series([
    function (cb) {
      // If the CSRF token was not posted, this was not a form submit.
      // Bail as error to skip further processing.
      if (options._csrf == undefined) {
        return cb(true);
      }

      return cb();
    },
    function (cb) {
      var opts = {require_tld: false, require_protocol: true};
      if (!validator.isURL(options.redirectUri, opts)) {
        message = "Redirect URI is not valid.";
        return cb(true);
      }
      if (!validator.isURL(options.loginUri, opts)) {
        message = "Login URI is not valid.";
        return cb(true);
      }
      if (options.clientId.match(/^[a-z0-9]+[a-z0-9\-]*$/) === null) {
        message = "ClientId must be a valid machine name. (Lowercase letters, numbers, and hyphens)";
        return cb(true);
      }

      return cb();
    },
    function (cb) {
      Client.findOne({clientId: options.clientId}, function(err, app) {
        if (err) {
          message = "Could not load clients. Please try again."
          log.warn({type: 'admin:clientList:error', message: 'Failed to load list of clients.'});
          return cb(true)
        }
        else if (app != null) {
          message = "Please select a unique Client ID."
          data = options;
          data.clientId = '';
          return cb(true);
        }

        return cb();
      });
    },
    function (cb) {
      // Process/save the submitted form values.
      submitted = true;

      if (options.clientId == 'create') {
        message = 'Create is a reserved word and cannot be used as a Client ID.';
        return cb(true);
      }

      if (options.clientSecret == '') {
        options.clientSecret = require('../lib/secretKey').generate();
      }

      var app = new Client(options);
      return app.save(function (err, item) {
        if (err || !item) {
          message = "Error creating the client application.";
          log.warn({'type': 'client:error', 'message': 'Error occurred trying to create client for ID ' + data.clientId + '.', 'data': data, 'err': err});
          return cb(true);
        }
        else {
          data = item;
          message = "Client settings successfully saved.";
          log.info({'type': 'client:success', 'message': 'Client application created for ID ' + data.clientId + '.', 'data': data});
          res.redirect('/admin/apps/' + options.clientId);
          return cb();
        }
      });
    }
  ],
  function (err, results) {
    res.render('appFormPage', {
      user: req.user,
      action: listOperations().create,
      app: data,
      message: message,
      csrf: req.csrfToken(),
      redirect_uri: redirect_uri,
      cancel_uri: cancel_uri,
      complete: submitted,
      next: next
    });
  });
};
