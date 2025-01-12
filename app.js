const express = require("express");
const config = require("./config/dbConnect");
const path = require("path");
const app = express();
// const swaggerDefinition = require('./swagger.json');
// const swaggerUi = require('swagger-ui-express')
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUI = require("swagger-ui-express");
require("dotenv").config();
const fileUpload = require("express-fileupload");
const cors = require("cors");
const morgan = require("morgan");
const acceptLanguageParser = require("accept-language-parser");
const i18n = require("i18n");
const expressWinston = require("express-winston");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
var cron = require("node-cron");
const cronManager = require("./cron/cronManager");
global.__basedir = __dirname;
app.use(express.static(__basedir + "/"));
// if (process.env.ENVIRONMENT == "development") {
//   app.use(morgan("dev"));
// }
app.use(morgan("dev"));
//*****Swagger api doc***/

app.use(express.json());
app.use(fileUpload());
app.use(
  express.urlencoded({
    extended: true,
  })
);
const port = process.env.PORT;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Green House",
      version: "1.0.0",
    },
    servers: [
      {
        url: process.env.BASE_URL,
      },
    ],
  },
  apis: ["./routes/*.js"], //your route folder
};

const swaggerSpec = swaggerJSDoc(options);
const swaggerDocument = require("./swagger.json");
app.use(
  "/api-docs",
  function (req, res, next) {
    swaggerDocument.host = req.get("host");
    req.swaggerDoc = swaggerDocument;
    next();
  },
  swaggerUI.serveFiles(swaggerDocument, options),
  swaggerUI.setup()
);
//for localization

app.use((req, res, next) => {
  const languages = acceptLanguageParser.parse(req.headers["accept-language"])
    ? acceptLanguageParser.parse(req.headers["accept-language"])
    : "en";
  const language = languages && languages[0] ? languages[0].code : "en";
  i18n.configure({
    locales: ["en", "ar"],
    directory: __dirname + "/locales",
    defaultLocale: language,
  });

  next();
});

require("./helper/logs");
global.__basedir = __dirname;

app.use(morgan("combined"));
if (process.env.ENVIRONMENT == "development") {
  app.use(morgan("dev"));
}

//Winston logger
// const requestLogger = expressWinston.logger({
//   transports: [
//     // new winston.transports.Console(), // Log to the console for development
//     new DailyRotateFile({
//       filename: 'logs/%DATE%/info.log',
//       datePattern: 'YYYY-MM-DD',
//       zippedArchive: true,
//       maxSize: '20m',
//       maxFiles: '14d',
//       level: 'info',
//     }),
//     new DailyRotateFile({
//       filename: 'logs/%DATE%/error.log',
//       datePattern: 'YYYY-MM-DD',
//       zippedArchive: true,
//       maxSize: '20m',
//       maxFiles: '14d',
//       level: 'error',
//     }),
//     new DailyRotateFile({
//       filename: 'logs/%DATE%/warn.log',
//       datePattern: 'YYYY-MM-DD',
//       zippedArchive: true,
//       maxSize: '20m',
//       maxFiles: '14d',
//       level: 'warn',
//     }),
//   ],
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json()
//   ),
//   meta: true, // Disable logging metadata (such as response time)
//   msg: 'HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}}',
//   expressFormat: true,
//   colorize: false
//   // skip: skipLoggerForBaseURL, // Skip logging for base URL
// });

// Attach the request logger middleware to all routes
// app.use(requestLogger);

// Set the views folder and use EJS as the template engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(cors());
require("./routes/index")(app);

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

//***********Create Server********** */
if (process.env.IsProduction == "true") {
  // var httpsServer = require("https").createServer(credentials, app);
  // httpsServer.listen(process.env.PORT, () => {
  //   console.log(
  //     "HTTPS Server is up and running on port numner " + process.env.PORT
  //   );
  // });
} else {
  var httpsServer = require("http").createServer(app);
  const socket = require("socket.io");
  const io = socket(httpsServer, {
    cors: {
      origin: "*",
    },
  });
  require("./services/chat")(io);

  httpsServer.listen(process.env.PORT, () => {
    //After notification after win the bid
    cron.schedule("*/5 * * * *", () => {
      cronManager.sendNotificationsEveryFiveMinutes();
    });
    //This is run on 12am for feature bid
    cron.schedule("0 0 * * *", () => {
      console.log("++++++++++++++++++++++");
      cronManager.featureProduct();
    });

    cron.schedule("* * * * * ", () => {
      console.log("Every 2 min");
      cronManager.sendNotificationsEveryTwoMinutes();
    });
    console.log(
      "HTTP Server is up and running on port numner " + process.env.PORT
    );
  });
}
