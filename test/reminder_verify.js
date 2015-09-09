process.env.NODE_ENV = 'test';
var should = require('should');

var User = require('../models').User;

describe('reminder_verify email', function() {

    it('should not send to active user', function (done) {
      var current = Date.now();
      var before = current.valueOf() - 3600 * 1000;
      var user = new User({
        user_id: 'guillaume@viguierjust.com_1',
        email: 'guillaume@viguierjust.com',
        active: 1
      });
      var out = user.shouldSendReminderVerify();
      should(out).eql(false);
      done();
    });

    it('should not send to user created less than 24 hours ago', function (done) {
      var current = Date.now();
      var before = current.valueOf() - 3600 * 1000;
      var user = new User({
        user_id: 'guillaume@viguierjust.com_' + before,
        email: 'guillaume@viguierjust.com',
        active: 0
      });
      var out = user.shouldSendReminderVerify();
      should(out).eql(false);
      done();
    });

    it('should not send to user reminded less than 3 days ago', function (done) {
      var current = Date.now();
      var before = current.valueOf() - 3600 * 1000;
      var user = new User({
        user_id: 'guillaume@viguierjust.com_1',
        email: 'guillaume@viguierjust.com',
        active: 0,
        reminded_verify: before
      });
      var out = user.shouldSendReminderVerify();
      should(out).eql(false);
      done();
    });

    it('should send to user never reminded', function (done) {
      var user = new User({
        user_id: 'guillaume@viguierjust.com_1',
        email: 'guillaume@viguierjust.com',
        active: 0
      });
      var out = user.shouldSendReminderVerify();
      should(out).eql(true);
      done();
    });

    it('should send to user reminded more than 3 days ago', function (done) {
      var user = new User({
        user_id: 'guillaume@viguierjust.com_1',
        email: 'guillaume@viguierjust.com',
        active: 0,
        reminded_verify: 1
      });
      var out = user.shouldSendReminderVerify();
      should(out).eql(true);
      done();
    });
});
