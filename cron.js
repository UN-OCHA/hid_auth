var users = require('./lib/users'),
    async = require('async');

async.auto({
  reminderVerify: users.sendReminderVerifyEmails,
},
function (err, results) {
  console.log('test');
  if (err) {
    console.log("hid_auth cron run failed.");
  }
  else {
    console.log("Finished hid_auth cron run successfully.");
  }
  process.exit(err ? 1 : 0);
});
