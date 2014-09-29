exports.index = function(req, res){
  res.render('index', {client_id: req.query.client_id, csrf: req.csrfToken()});
};

exports.register = require('./register');
exports.session = require('./session');
exports.users = require('./users');
