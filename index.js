var express  = require('express'),
    multer   = require('multer'),
    path     = require('path'),
    crypto   = require('crypto'),
    gm       = require('gm').subClass({imageMagick: true});

function invalidFileError(message){
    this.message = message;
}
invalidFileError.prototype = Error.prototype;

function fileFilter (req, file, cb) {
  if (/^image\/.*/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new invalidFileError('The file you uploaded is not a picture.'));
  }
}

var customStorage = multer.diskStorage({
  destination: path.join(__dirname, 'public/images'),
  filename: function (req, file, cb) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      // TODO: replace slice(-1)[0] with a better solution
      cb(err, err ? undefined : raw.toString('hex') + '.' + file.mimetype.split('/').slice(-1)[0]);
    });
  }
});

var uploader = multer({
  storage: customStorage,
  fileFilter: fileFilter
});

var app = express();
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'jade');

app.post('/images', uploader.single('attachment'), function (req, res, next) {
  res.status(201);
  var parts = req.file.filename.split('.');
  var rawPath = req.file.destination + '/' + parts[0];
  var baseUrl = req.protocol + '://' + req.get('host') + '/images/' + parts[0];

  var img = gm(req.file.destination + '/' + req.file.filename);
  img.size(function(err, size) {
    if (size.width > 128 && size.height > 128) {
      img.resize(32).write(rawPath + '-x32.' + parts[1], function() {});
      img.resize(64).write(rawPath + '-x64.' + parts[1], function() {});
      res.render('resized', { baseUrl: baseUrl, ext: parts[1] });
    } else {
      res.render('not_resized', { baseUrl: baseUrl, ext: parts[1] });
    }
  });
});

app.get('/', function(req, res){
  res.render('form');
});

function logErrors(err, req, res, next) {
  console.error(err.stack);
  next(err);
}

function invalidFileErrorHandler(err, req, res, next) {
  if (err instanceof invalidFileError) {
    res.status(415).render('error', { error: err.message }).end();
  } else {
    next(err);
  }
}

function missingFileErrorHandler(err, req, res, next) {
  if (/filename/.test(err.message)) {
    res.status(400).render('error', { error: 'Please specify a file to upload' }).end();
  } else {
    next(err);
  }
}

function genericErrorHandler(err, req, res, next) {
  res.status(500).render('error', { error: err.message });
}

app.use(logErrors);
app.use(missingFileErrorHandler);
app.use(invalidFileErrorHandler);
app.use(genericErrorHandler);

app.use(function(req, res, next) {
  res.status(404).render('404');
});

var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('App started and listening at http://%s:%s', host, port);
});
