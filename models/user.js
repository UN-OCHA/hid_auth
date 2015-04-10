var bcrypt = require('bcrypt');
var crypto = require('crypto');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ValidationError = require('./../errors').ValidationError;

var OAuthUsersSchema = new Schema({
  user_id: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  email_recovery: { type: String },
  hashed_password: { type: String, required: true },
  password_reset_token: { type: String },
  reset_token_expires: Date,
  name_given: String,
  name_family: String,
  authorized_services: Schema.Types.Mixed,
  active: Number
});

function hashPassword(password) {
  return bcrypt.hashSync(password, 11);
}

OAuthUsersSchema.static('register', function(fields, cb) {
  var user;

  fields.hashed_password = hashPassword(fields.password);
  delete fields.password;

  fields.user_id = fields.email + '_' + Date.now();

  user = new OAuthUsersModel(fields);
  user.save(cb);
});

OAuthUsersSchema.static('getUser', function(email, password, cb) {
  OAuthUsersModel.authenticate(email, password, function(err, user) {
    if (err || !user) return cb(err);
    cb(null, user.email);
  });
});

OAuthUsersSchema.static('authenticate', function(email, password, cb) {
  this.findOne({email: new RegExp(email, 'i')}, function(err, user) {
    if (err || !user) return cb(err);
    cb(null, bcrypt.compareSync(password, user.hashed_password) && user.active ? user : null);
  });
});

mongoose.model('users', OAuthUsersSchema);

var OAuthUsersModel = mongoose.model('users');
OAuthUsersModel.hashPassword = hashPassword;
module.exports = OAuthUsersModel;
