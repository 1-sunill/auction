const nodemailer = require("nodemailer");

const USER = process.env.EMAIL_USER;
const PASSWORD = process.env.EMAIL_PASS;

const mail = (req) => {
  return new Promise((resolve, reject) => {
    console.log(USER, PASSWORD);

    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: USER,
        pass: PASSWORD,
      },
    });

    var mailOptions = {
      from: USER,
      to: req.email ? req.email : USER,
      subject: req.subject ? req.subject : "Test Subject",
      text: req.text ? req.text : "Test Body",
      html: req.html ? req.html : "",
    };

    console.log(mailOptions);

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("Error:", error);
        reject(error);
      } else {
        console.log("Email sent:", info.response);
        resolve(info.response);
      }
    });
  });
};

module.exports = mail;
