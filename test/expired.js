process.env.NODE_ENV = 'test';
var should = require('should');

var User = require('../models').User;

describe('user expired', function() {

    it('should not be expired', function (done) {
      var user = new User({
        user_id: 'guillaume@viguierjust.com_1',
        email: 'guillaume@viguierjust.com',
        active: 1,
        expires: false,
        expiresAfter: 0
      });
      var out = user.isExpired();
      should(out).eql(false);
      done();
    });

    it('should not be expired', function (done) {
      var current = Date.now();
      var created = current.valueOf() - 3600;
      var expiresAfter = 7 * 24 * 3600;
      var user = new User({
        user_id: 'guillaume@viguierjust.com_' + created,
        email: 'guillaume@viguierjust.com',
        active: 0,
        expires: true,
        expiresAfter: expiresAfter
      });
      var out = user.isExpired();
      should(out).eql(false);
      done();
    });

    it('should be expired', function (done) {
      var current = Date.now();
      var created = current.valueOf() - 8 * 24 * 3600;
      var expiresAfter = 7 * 24 * 3600;
      var user = new User({
        user_id: 'guillaume@viguierjust.com_' + created,
        email: 'guillaume@viguierjust.com',
        active: 0,
        expires: true,
        expiresAfter: expiresAfter
      });
      var out = user.isExpired();
      should(out).eql(true);
      done();
    });

});
