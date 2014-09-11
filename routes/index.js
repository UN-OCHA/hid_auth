exports.index = function(req, res){
  res.redirect('/session');
};

exports.session = require('./session');
exports.users = require('./users');
