var Client = require('./../models').OAuthClientsModel;
var errors = require('./../errors');
var log = require('./../log');
var async = require('async');

module.exports.list = function(req, res) {
  var redirect_uri = req.body.redirect_uri || req.query.redirect_uri || '',
    cancel_uri = '/admin',
    message = null,
    currentUser = {},
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
            //item.ops = userOperations(item, false);
            item.description = item.description || '';
            return item;
          });
        }
        return cb();
      })
    },
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
