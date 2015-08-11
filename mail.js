var nodemailer = require('nodemailer');
var config = require('./config');
var path = require('path');
var templatesDir = path.resolve(__dirname, 'templates');
var EmailTemplate = require('email-templates').EmailTemplate;

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
  host: config.smtpHost || 'localhost',
  port: config.smtpPort || 25,
  auth: {
    user: config.smtpUser || null,
    pass: config.smtpPass || null
  }
});

transporter.sendTemplate = function (templateName, locals, fn) {
  var templateDir = path.join(templatesDir, templateName);
  var template = new EmailTemplate(templateDir);
  template.render(locals, function (err, result) {
    if (err) {
      return fn(err);
    }
    transporter.sendMail({
      from: locals.from || 'Humanitarian ID <info@humanitarian.id>',
      to: locals.to,
      subject: locals.subject,
      cc: locals.cc || '',
      html: result.html,
      text: result.text
    }, function (err, info) {
      if (err) {
        return fn(err);
      }
      return fn(null, info);
    });
  });
};


module.exports = transporter;
