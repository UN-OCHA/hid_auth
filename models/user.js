var bcrypt = require('bcrypt');
var crypto = require('crypto');
var escapeStringRegexp = require('escape-string-regexp');
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
  active: Number,
  roles: [String],
  login_last: Date,
  reminded_verify: Number // timestamp
});

function hashPassword(password) {
  return bcrypt.hashSync(password, 11);
}

// Whether we should send a reminder to verify email to user
OAuthUsersSchema.methods.shouldSendReminderVerify = function() {
  var created = this.user_id.replace(this.email + '_', '');
  var current = Date.now();
  var offset = current.valueOf() - created;
  if (this.active || offset < 24 * 3600 * 1000) {
    return false;
  }
  else {
    if (this.reminded_verify && current.valueOf() - this.reminded_verify < 72 * 3600 * 1000) {
      return false;
    }
    else {
      return true;
    }
  }
};


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
  this.findOne({email: new RegExp('^' + escapeStringRegexp(email) + '$', 'i')}, function(err, user) {
    if (err || !user) return cb(err);
    cb(null, bcrypt.compareSync(password, user.hashed_password) && user.active ? user : null);
  });
});

mongoose.model('users', OAuthUsersSchema);

var OAuthUsersModel = mongoose.model('users');
OAuthUsersModel.hashPassword = hashPassword;
module.exports = OAuthUsersModel;
