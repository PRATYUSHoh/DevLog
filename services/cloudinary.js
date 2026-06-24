const cloudinary = require('../config/cloudinary');
const crypto = require('crypto');
const path = require('path');

const uploadToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const options = {
            resource_type: 'auto',
            folder: 'uploads',
            public_id: crypto.randomBytes(16).toString('hex'),
        };
        const stream = cloudinary.uploader.upload_stream(options,
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        stream.end(buffer);
    });
};

module.exports = { uploadToCloudinary };