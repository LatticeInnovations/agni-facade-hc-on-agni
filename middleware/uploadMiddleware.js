const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure multer storage and file name
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, req.query.web == "true" ? new Date().getTime() + '_' + file.originalname : file.originalname);
    }
});

const upload = multer({ storage: storage });

const uploadMiddleware = (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ status: 0,
            message: "Cannot upload more than 10 files.",
            err: {} 
        });
    }
    const files = req.files;
    const errors = [];
    const successFiles = [];
    files.forEach((file) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpeg', 'application/pdf', 'image/img', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 30 * 1024 * 1024; // 30MB
    
      if (!allowedTypes.includes(file.mimetype)) {
        errors.push({ filename : file.filename, originalname : file.originalname, error: "Invalid file type" });
      }
      else if (file.size > maxSize) {
        errors.push({ filename : file.filename, originalname : file.originalname, error: "file greater than 30MB" });
      }
      else {
        successFiles.push(file);
      }
    });

    if (errors.length > 0) {
      errors.forEach((file) => {
        fs.unlinkSync('uploads/'+file.filename);
      });
    }
    req.files = files;
    req.errors = errors;
    req.successFiles = successFiles;
    next();
  });
};

module.exports = uploadMiddleware;