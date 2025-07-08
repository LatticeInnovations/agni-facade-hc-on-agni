let { validationResult } = require('express-validator');
let validationResponse = require("../utils/responseStatus");
const fs = require('fs');

const uploadFiles = async (req, res) => {
    console.log("inside uploads controller");
    const files = req?.files;
    const errors =  req?.errors;
    const successFiles = req?.successFiles;
    try{
        const fileNames = [];
        successFiles.forEach((file)=>{
            fileNames.push({originalName: file.originalname, filename : file.filename, url: file.path });
        });
        console.log(successFiles, fileNames)
        return res.status(200).json({ status: 1, message: "files uploaded", data: { files: fileNames, errors } });
    }
    catch (e) {
        console.error(e);
        files.forEach((file) => {
            fs.unlinkSync(file.path);
        });
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }
}

const downloadFile = async (req, res) => {
    try{
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return validationResponse.sendInvalidDataError(res, errors);
        } 
        const filename = req.query.name;
        if (fs.existsSync(`uploads/${filename}`)) {
            res.download(`uploads/${filename}`);
        }
        else {
            res.status(400).json({ status: 0, error: 'file does not exist' });
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }
}

const getAllFiles = async (req, res) => {
    try{
        let files = [];
        fs.readdirSync('uploads').forEach(file => {
            files.push(file);
        });
        res.json({ status: 1, files});
    }
    catch(error){
        console.error(error);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: error
        })
    }
}

const downloadMultipleFiles = async (req, res) => {
    try{
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return validationResponse.sendInvalidDataError(res, errors);
        } 
        let files = req.body.files;
        let validFiles = [];
        files.forEach((file) => {
            if (fs.existsSync(`uploads/${file}`)) {
                validFiles.push({ path : `uploads/${file}`, name : file });
            }
        });
        res.zip(validFiles);
    }
    catch(error){
        console.error(error);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: error
        })
    }
}

module.exports = {
    uploadFiles,
    downloadFile,
    getAllFiles,
    downloadMultipleFiles,
}