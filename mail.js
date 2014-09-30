
var nodemailer = require('nodemailer');

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25
});

module.exports = transporter;
