var User = require('./../models').User;
var errors = require('./../errors');

module.exports.create = function(req, res, next) {
  User.register(req.body.user, function(err, user) {
    if (err) return next(err);
    res.send(user);
  });
};

module.exports.show = function(req, res, next) {
  User.findOne({ email: req.session.userId}, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new errors.NotFound('User not found'));
    res.render('account', { user: user });
  });
};

module.exports.showjson = function(req, res, next) {
  User.findOne({ email: req.user.id}, function(err, user) {
    if (err) return next(err);
    if (!user) return next(new errors.NotFound('showjson: User not found for ' + req.session.userId, req.session));
    res.send('{"id": "' + user.email + '"}');
  });
};
