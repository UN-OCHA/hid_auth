exports.index = function(req, res){
  res.redirect('/session');
};

exports.register = require('./register');
exports.session = require('./session');
exports.users = require('./users');
