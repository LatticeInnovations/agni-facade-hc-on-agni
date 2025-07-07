let express = require("express");
const router = express.Router();
const { query, check } = require('express-validator');
const { uploadFiles, downloadFile, getAllFiles, downloadMultipleFiles } = require("../../controllers/fileUpload");
const auth = require("../../middleware/checkAuth");
const uploadMiddleware = require('../../middleware/uploadMiddleware');

router.post('/files', uploadMiddleware, uploadFiles);

router.get('/file', [query('name').notEmpty() ], downloadFile);

router.get('/filenames', getAllFiles);

router.post('/files', [check('files').isArray({min: 1, max: 10})], downloadMultipleFiles);

module.exports = router;